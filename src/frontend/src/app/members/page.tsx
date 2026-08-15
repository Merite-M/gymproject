export default function MembersPage() {
  return (
    <div className="flex h-full items-center justify-center text-gray-500 font-body-base bg-white shadow-sm m-6 rounded-xl border border-gray-100">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-4">
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900">Select a Member</h3>
        <p className="mt-2 text-sm text-gray-500 max-w-sm mx-auto">
          Choose a member from the directory on the left to view their full
          profile, billing history, and activity logs.
        </p>
      </div>
    </div>
  );
}
