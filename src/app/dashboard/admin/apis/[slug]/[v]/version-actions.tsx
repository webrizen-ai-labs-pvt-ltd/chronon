"use client";

import { navigate } from "@/components/admin/nav-progress";
import { Archive, GitBranch01, ReverseLeft, Rocket01, SlashCircle01, Trash01 } from "@untitledui/icons";
import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/admin/interactive";
import { discardDraftAction, nextVersionAction, publishAction, setVersionStateAction } from "../../actions";

type Props = { slug: string; version: number; size?: "xs" | "sm" | "md" };

export function PublishButton({ slug, version, size = "md", primary = true }: Props & { primary?: boolean }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label={`Publish v${version}`}
      size={size}
      color={primary ? "primary" : "secondary"}
      iconLeading={<Rocket01 data-icon="leading" />}
      title={`Publish v${version}?`}
      body={
        <p>
          <code className="font-mono">/v{version}/{slug}</code> goes live for every API key within 15 seconds. After publishing, schema changes must be
          additive (new fields, filters, collections); anything breaking goes into v{version + 1}. Records stay editable.
        </p>
      }
      confirmLabel="Publish"
      onConfirm={async () => {
        const res = await publishAction(slug, version);
        if (res.ok) router.refresh();
        return res;
      }}
    />
  );
}

export function NextVersionButton({ slug, version, size = "sm" }: Props) {
  const router = useRouter();
  return (
    <ConfirmButton
      label={`Start v${version + 1}`}
      size={size}
      iconLeading={<GitBranch01 data-icon="leading" />}
      title={`Start v${version + 1}?`}
      body={
        <p>
          Creates a private draft that copies v{version}&apos;s schema and records. Make breaking changes there, publish it, then deprecate v{version}{" "}
          so clients have time to move.
        </p>
      }
      confirmLabel="Create draft"
      onConfirm={async () => {
        const res = await nextVersionAction(slug);
        if (res.ok) navigate(router, `/dashboard/admin/apis/${slug}/v${res.value}`);
        return res;
      }}
    />
  );
}

export function StateButton({ slug, version, to, size = "sm" }: Props & { to: "published" | "deprecated" | "retired" }) {
  const router = useRouter();
  const copy = {
    deprecated: {
      label: "Deprecate",
      icon: <Archive data-icon="leading" />,
      title: `Deprecate v${version}?`,
      body: "It keeps working, but responses carry a Deprecation header and a link to the newest version. Undo any time.",
      confirm: "Deprecate",
      tone: "default" as const,
    },
    retired: {
      label: "Retire",
      icon: <SlashCircle01 data-icon="leading" />,
      title: `Retire v${version}?`,
      body: "Every request to this version gets 410 Gone. Clients still on it will break. You can bring it back to deprecated later.",
      confirm: "Retire",
      tone: "danger" as const,
    },
    published: {
      label: "Restore",
      icon: <ReverseLeft data-icon="leading" />,
      title: `Restore v${version}?`,
      body: "Clears the deprecation: the version is served as fully supported again.",
      confirm: "Restore",
      tone: "default" as const,
    },
  }[to];
  return (
    <ConfirmButton
      label={copy.label}
      size={size}
      tone={copy.tone}
      iconLeading={copy.icon}
      title={copy.title}
      body={<p>{copy.body}</p>}
      confirmLabel={copy.confirm}
      onConfirm={async () => {
        const res = await setVersionStateAction(slug, version, to);
        if (res.ok) router.refresh();
        return res;
      }}
    />
  );
}

export function DiscardDraftButton({ slug, version, size = "sm" }: Props) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="Discard"
      size={size}
      tone="danger"
      iconLeading={<Trash01 data-icon="leading" />}
      title={`Discard the v${version} draft?`}
      body={<p>Deletes the draft&apos;s schema and records. Published versions aren&apos;t affected. This can&apos;t be undone.</p>}
      confirmLabel="Discard draft"
      onConfirm={async () => {
        const res = await discardDraftAction(slug, version);
        if (res.ok) navigate(router, `/dashboard/admin/apis/${slug}`);
        return res;
      }}
    />
  );
}
