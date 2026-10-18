//! How the agent's tools reach the app. The project lives in the frontend (React
//! state, the 3D viewer), so a tool call is forwarded there as an event and
//! its answer comes back through the `agent_reply` command.

use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde_json::{Value, json};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::oneshot;

pub type BoxFuture<T> = Pin<Box<dyn Future<Output = T> + Send>>;

/// Something that can run an operation inside the app. The MCP tools only know
/// this trait, so they can be tested without a window.
pub trait Bridge: Send + Sync + 'static {
    fn call(
        &self,
        op: &'static str,
        args: Value,
        timeout: Duration,
    ) -> BoxFuture<Result<Value, String>>;
}

type Reply = Result<Value, String>;

/// Calls waiting for the frontend to answer.
#[derive(Default)]
pub struct Pending(Mutex<HashMap<u64, oneshot::Sender<Reply>>>);

impl Pending {
    fn add(&self, id: u64) -> oneshot::Receiver<Reply> {
        let (tx, rx) = oneshot::channel();
        self.0.lock().unwrap_or_else(std::sync::PoisonError::into_inner).insert(id, tx);
        rx
    }

    fn take(&self, id: u64) -> Option<oneshot::Sender<Reply>> {
        self.0.lock().unwrap_or_else(std::sync::PoisonError::into_inner).remove(&id)
    }
}

pub struct TauriBridge {
    app: AppHandle,
    pending: Arc<Pending>,
    next: AtomicU64,
}

impl TauriBridge {
    pub fn new(app: AppHandle, pending: Arc<Pending>) -> Self {
        Self {
            app,
            pending,
            next: AtomicU64::new(1),
        }
    }
}

impl Bridge for TauriBridge {
    fn call(&self, op: &'static str, args: Value, timeout: Duration) -> BoxFuture<Reply> {
        let id = self.next.fetch_add(1, Ordering::Relaxed);
        let rx = self.pending.add(id);
        let pending = self.pending.clone();
        let sent = self
            .app
            .emit("agent:request", json!({ "id": id, "op": op, "args": args }));
        Box::pin(async move {
            if let Err(e) = sent {
                pending.take(id);
                return Err(format!("could not reach the app window: {e}"));
            }
            match tokio::time::timeout(timeout, rx).await {
                Ok(Ok(reply)) => reply,
                Ok(Err(_)) => Err("the app dropped the request".into()),
                Err(_) => {
                    pending.take(id);
                    Err(format!(
                        "the app did not answer {op} within {} s",
                        timeout.as_secs()
                    ))
                }
            }
        })
    }
}

/// The frontend's answer to an `agent:request` event.
#[tauri::command]
pub fn agent_reply(id: u64, ok: bool, value: Value, pending: State<'_, Arc<Pending>>) {
    if let Some(tx) = pending.take(id) {
        let _ = tx.send(if ok {
            Ok(value)
        } else {
            Err(value
                .as_str()
                .map(str::to_owned)
                .unwrap_or_else(|| value.to_string()))
        });
    }
}

#[cfg(test)]
pub mod mock {
    use super::*;

    type Handler = dyn Fn(&'static str, Value) -> Reply + Send + Sync;

    /// A bridge that answers from a closure and records what it was asked.
    pub struct Mock {
        handler: Box<Handler>,
        pub calls: Mutex<Vec<(&'static str, Value)>>,
    }

    impl Mock {
        pub fn new(
            handler: impl Fn(&'static str, Value) -> Reply + Send + Sync + 'static,
        ) -> Arc<Self> {
            Arc::new(Self {
                handler: Box::new(handler),
                calls: Mutex::new(Vec::new()),
            })
        }

        /// Answers immediately and records the call, for tests that wrap a mock.
        pub fn call_now(&self, op: &'static str, args: Value) -> Reply {
            self.calls.lock().unwrap().push((op, args.clone()));
            (self.handler)(op, args)
        }
    }

    impl Bridge for Mock {
        fn call(&self, op: &'static str, args: Value, _timeout: Duration) -> BoxFuture<Reply> {
            let r = self.call_now(op, args);
            Box::pin(async move { r })
        }
    }

    #[tokio::test]
    async fn pending_roundtrip() {
        let p = Pending::default();
        let rx = p.add(7);
        p.take(7).unwrap().send(Ok(json!(1))).unwrap();
        assert_eq!(rx.await.unwrap().unwrap(), json!(1));
        assert!(p.take(7).is_none());
    }
}
