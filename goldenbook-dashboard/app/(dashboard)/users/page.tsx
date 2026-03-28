import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export default function UsersPage() {
  return (
    <div className="max-w-5xl">
      <Card>
        <div className="flex flex-col items-center justify-center py-16 gap-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#FBF7F0] flex items-center justify-center text-gold">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-text">Users</h2>
            <p className="text-base text-muted mt-2 max-w-sm">
              This section is under construction. User management will be available soon.
            </p>
          </div>
          <Button variant="primary">Add New User</Button>
        </div>
      </Card>
    </div>
  );
}
