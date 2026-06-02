import { Card, CardContent } from './ui';

interface OrganogramMember {
  user_id: string;
  display_name: string;
  employee_code?: string;
  clocked_in: boolean;
  drop_off_location?: string;
}

interface FamilyTreeOrganogramProps {
  parentName: string;
  parentCode?: string;
  parentClockedIn: boolean;
  members: OrganogramMember[];
  title?: string;
}

export function FamilyTreeOrganogram({
  parentName,
  parentCode,
  parentClockedIn,
  members,
  title,
}: FamilyTreeOrganogramProps) {
  return (
    <Card className="border-blue-100">
      <CardContent className="p-4 space-y-3">
        {title && <h3 className="text-sm font-semibold text-center">{title}</h3>}

        <div className="flex justify-center">
          <div className="text-center p-3 rounded-lg bg-blue-50 border border-blue-200 min-w-[200px]">
            <svg className="h-6 w-6 mx-auto text-blue-600 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <p className="font-semibold text-sm">{parentName}</p>
            {parentCode && <p className="text-xs text-gray-500">{parentCode}</p>}
            <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${parentClockedIn ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {parentClockedIn ? 'Clocked In' : 'Not Clocked In'}
            </span>
          </div>
        </div>

        {members.length > 0 && (
          <>
            <div className="flex justify-center">
              <div className="w-px h-4 bg-gray-200" />
            </div>
            <div className="border-t border-gray-200 pt-3">
              <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Team Members ({members.filter(c => c.clocked_in).length}/{members.length} clocked in)
              </p>
              <div className="space-y-2">
                {members.map((child) => (
                  <div
                    key={child.user_id}
                    className={`p-2.5 rounded-lg border text-sm ${
                      child.clocked_in
                        ? 'bg-green-50 border-green-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${child.clocked_in ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className="font-medium truncate">{child.display_name}</span>
                        {child.employee_code && (
                          <span className="text-xs text-gray-500 shrink-0">{child.employee_code}</span>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ml-2 ${child.clocked_in ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {child.clocked_in ? 'Clocked In' : 'Pending'}
                      </span>
                    </div>
                    {child.clocked_in && child.drop_off_location && (
                      <p className="text-xs text-gray-500 mt-1 ml-4">
                        Drop-off: {child.drop_off_location}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
