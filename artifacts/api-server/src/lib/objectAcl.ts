import type { File } from "@google-cloud/storage";

const ACL_POLICY_METADATA_KEY = "custom:aclPolicy";

export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
}

export enum ObjectPermission {
  READ = "read",
  WRITE = "write",
}

export async function setObjectAclPolicy(
  file: File,
  policy: ObjectAclPolicy,
): Promise<void> {
  const [exists] = await file.exists();
  if (!exists) throw new Error("The uploaded photo does not exist.");
  await file.setMetadata({
    metadata: { [ACL_POLICY_METADATA_KEY]: JSON.stringify(policy) },
  });
}

export async function getObjectAclPolicy(
  file: File,
): Promise<ObjectAclPolicy | null> {
  const [metadata] = await file.getMetadata();
  const value = metadata.metadata?.[ACL_POLICY_METADATA_KEY];
  if (typeof value !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "owner" in parsed &&
      "visibility" in parsed &&
      typeof parsed.owner === "string" &&
      (parsed.visibility === "public" || parsed.visibility === "private")
    ) {
      return parsed as ObjectAclPolicy;
    }
  } catch {
    return null;
  }
  return null;
}

export async function canAccessObject(
  file: File,
  requestedPermission: ObjectPermission,
): Promise<boolean> {
  const policy = await getObjectAclPolicy(file);
  return (
    requestedPermission === ObjectPermission.READ &&
    policy?.visibility === "public"
  );
}
