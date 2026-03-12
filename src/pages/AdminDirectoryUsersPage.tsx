import { useEffect, useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { PageHeader } from "../components/PageHeader";
import { Pane } from "../components/Pane";

type DirectoryUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  emailVerified: number;
  createdAt: string;
  updatedAt: string;
};

async function parseJsonResponse<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export function AdminDirectoryUsersPage() {
  const [users, setUsers] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) {
        setUsers([]);
        setLoading(false);
        return;
      }

      const data = await parseJsonResponse<DirectoryUser[]>(res);
      setUsers(data ?? []);
      setLoading(false);
    };

    void load();
  }, []);

  return (
    <AppLayout>
      <PageHeader title="Users" />

      <Pane className="mt-5 overflow-hidden">
        {loading ? (
          <p className="py-14 text-center text-[14px] text-[#8990a3]">Loading users...</p>
        ) : users.length === 0 ? (
          <p className="py-14 text-center text-[14px] text-[#8990a3]">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-[#f8f9fc]">
                <tr className="border-b border-[#e7eaf2] text-[12px] font-semibold uppercase tracking-[0.04em] text-[#7b8195]">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Verified</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-[#eef1f6] text-[13px] text-[#3f455c]">
                    <td className="px-4 py-3 font-semibold text-[#232733]">{user.name}</td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">{user.emailVerified ? "Yes" : "No"}</td>
                    <td className="px-4 py-3">{new Date(user.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Pane>
    </AppLayout>
  );
}
