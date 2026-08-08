import { CopyButton } from "@/components/copy-button";
import { cn } from "@/lib/utils";

export type TagGroup = {
  label: string;
  items: string[];
};

/**
 * The shared "chip grid" for brand profile arrays (services, audiences,
 * pain points, etc.) — extracted from what used to be duplicated inline
 * in both the onboarding review step and project settings. Every chip and
 * every group gets its own copy affordance.
 */
export function TagList({
  groups,
  compact,
}: {
  groups: TagGroup[];
  compact?: boolean;
}) {
  return (
    <div className={cn("research-profile-grid", compact && "compact")}>
      {groups.map((group) => (
        <div className="research-profile-group" key={group.label}>
          <div className="research-profile-group-heading">
            <span>{group.label}</span>
            {group.items.length > 0 ? (
              <CopyButton
                value={group.items.join("\n")}
                label={`all ${group.label.toLowerCase()}`}
                small
              />
            ) : null}
          </div>
          {group.items.length > 0 ? (
            <ul>
              {group.items.map((item) => (
                <li key={item}>
                  <span>{item}</span>
                  <CopyButton value={item} label={item} small />
                </li>
              ))}
            </ul>
          ) : (
            <small>No reliable evidence found.</small>
          )}
        </div>
      ))}
    </div>
  );
}
