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
    <Group
      component="header"
      gap="xs"
      wrap="nowrap"
      h={38}
      px={{ base: 8, md: 10 }}
      bg="var(--surface)"
      bd="0 solid var(--border)"
      style={{ borderBottomWidth: 1, flex: "none" }}
    >
      <Group gap={6} wrap="nowrap" mr={6} c="var(--accent)" fw={650}>
        <Image src="/logo.svg" w={20} h={20} alt="" />
        <Text visibleFrom="md" inherit>Frederic Coultier</Text>
      </Group>
      <Group component="nav" gap={0} wrap="nowrap" role="menubar" flex={{ base: 1, md: "none" }}>
        {menus.map((m) =>
          m.items ? (
            <MantineMenu key={m.id} trigger="click-hover" openDelay={0} closeDelay={80} position="bottom-start" shadow="md" width={230}>
              <MantineMenu.Target>
                <Button variant="subtle" color="gray" c="var(--text)" size="compact-md" fw={400}>
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
            <Button key={m.id} variant="subtle" color="gray" c="var(--text)" size="compact-md" fw={400} onClick={m.onSelect}>
              {m.label}
            </Button>
          ),
        )}
      </Group>
      <Text visibleFrom="md" flex={1} ta="center" c="dimmed" truncate="end" title={title}>
        {title}
        {dirty && <Text span c="var(--accent)" fz={10} ml={6} aria-label="unsaved">●</Text>}
      </Text>
      {trailing}
    </Group>
  );
}
