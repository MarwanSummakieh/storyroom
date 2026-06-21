import { initials } from "@/lib/utils";

type AvatarProps = {
  name: string;
  color: string;
  size?: "sm" | "md";
};

export function Avatar({ name, color, size = "md" }: AvatarProps) {
  const dimension = size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";

  return (
    <span
      className={`${dimension} inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-sm ring-2 ring-white`}
      style={{ backgroundColor: color }}
      title={name}
      aria-label={name}
    >
      {initials(name) || "A"}
    </span>
  );
}
