import * as React from "react";
import { DropdownMenuLabel } from "@/components/ui/dropdown-menu";

/**
 * The header of a thread menu: the icon and the title at the left, and a slot at the right for what the menu
 * shows beside its title, such as the Pending chip or the policy revision. The sessions and the activation
 * menus share it, so their titles match.
 */
export function MenuHead({
  icon,
  title,
  children
}: {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <DropdownMenuLabel className="menu-head">
      <span className="menu-head-title">
        {icon}
        <span>{title}</span>
      </span>
      {children === undefined ? null : (
        <span className="menu-head-slot">{children}</span>
      )}
    </DropdownMenuLabel>
  );
}
