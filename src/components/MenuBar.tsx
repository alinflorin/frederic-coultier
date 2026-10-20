import type { ReactNode } from "react";
import { Button, Group, Image, Kbd, Menu as MantineMenu, Text } from "@mantine/core";

export interface MenuItem {
  label: string;
  shortcut?: string;
  onSelect?: () => void;
  disabled?: boolean;
  separator?: boolean;
}
export interface Menu {
  id: string;
  label: string;
  /** A menu with no `items` is a plain button that runs this. */
  onSelect?: () => void;
  items?: MenuItem[];
}

export function MenuBar({ menus, title, dirty, trailing }: { menus: Menu[]; title: string; dirty: boolean; trailing?: ReactNode }) {
  return (
    <Group component="header" gap="xs" wrap="nowrap" h={46} px={{ base: 10, md: 14 }} style={{ flex: "none" }}>
      <Group gap={9} wrap="nowrap" mr={8}>
        <Image src="/logo.svg" w={22} h={22} alt="" />
        <Text visibleFrom="md" fw={650} fz={14} lts="-0.01em">Frederic Coultier</Text>
      </Group>
      <Group component="nav" gap={2} wrap="nowrap" role="menubar" flex={{ base: 1, md: "none" }}>
        {menus.map((m) =>
          m.items ? (
            <MantineMenu key={m.id} trigger="click-hover" openDelay={0} closeDelay={80} position="bottom-start" offset={6} width={240}>
              <MantineMenu.Target>
                <Button variant="subtle" color="gray" c="var(--text)" size="compact-md" fw={500} styles={{ root: { background: "transparent", border: "none", boxShadow: "none" } }}>
                  {m.label}
                </Button>
              </MantineMenu.Target>
              <MantineMenu.Dropdown>
                {m.items.map((it, i) =>
                  it.separator ? (
                    <MantineMenu.Divider key={i} />
                  ) : (
                    <MantineMenu.Item
                      key={i}
                      disabled={it.disabled}
                      onClick={it.onSelect}
                      rightSection={it.shortcut ? <Kbd size="xs" ml="md">{it.shortcut}</Kbd> : undefined}
                    >
                      {it.label}
                    </MantineMenu.Item>
                  ),
                )}
              </MantineMenu.Dropdown>
            </MantineMenu>
          ) : (
            <Button key={m.id} variant="subtle" color="gray" c="var(--text)" size="compact-md" fw={500} styles={{ root: { background: "transparent", border: "none", boxShadow: "none" } }} onClick={m.onSelect}>
              {m.label}
            </Button>
          ),
        )}
      </Group>
      <Group visibleFrom="md" flex={1} justify="center" gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
        {title && (
          <Group gap={8} wrap="nowrap" px={14} h={28} className="chip" title={title} style={{ maxWidth: "100%", fontSize: 12.5 }}>
            <Text inherit truncate="end" c="var(--text)" fw={550}>{title}</Text>
            {dirty && <span aria-label="unsaved" style={{ width: 7, height: 7, borderRadius: 99, background: "var(--accent)", boxShadow: "0 0 8px var(--accent)", flex: "none" }} />}
          </Group>
        )}
      </Group>
      {trailing}
    </Group>
  );
}
