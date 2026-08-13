const fs = require('fs');
const filePath = 'src/frontend/src/app/calendar/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const target1 = `const [calendarEnabled, setCalendarEnabled] = useState<boolean>(true);`;
const replacement1 = `const [calendarEnabled, setCalendarEnabled] = useState<boolean | null>(null);`;

const target2 = `    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
                if (data) {
                    setCurrentTenantId(data.tenant_id);
                    const { data: tenantData } = await supabase.from('tenants').select('calendar_enabled').eq('id', data.tenant_id).single();
                    if (tenantData) setCalendarEnabled(tenantData.calendar_enabled);
                }
            }
        };
        getUser();
    }, []);`;

const replacement2 = `    useEffect(() => {
        const getUser = async () => {
            try {
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                if (authError || !user) {
                    setCalendarEnabled(false);
                    return;
                }
                const { data, error: profileError } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
                if (profileError || !data) {
                    setCalendarEnabled(false);
                    return;
                }

                setCurrentTenantId(data.tenant_id);
                const { data: tenantData, error: tenantError } = await supabase.from('tenants').select('calendar_enabled').eq('id', data.tenant_id).single();

                if (tenantError || !tenantData) {
                    setCalendarEnabled(false);
                } else {
                    setCalendarEnabled(tenantData.calendar_enabled);
                }
            } catch (error) {
                setCalendarEnabled(false);
            }
        };
        getUser();
    }, []);`;

const target3 = `    if (!calendarEnabled && !loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-900 font-sans p-6">
                <AlertTriangle className="w-12 h-12 text-yellow-500 mb-4" />
                <h1 className="text-2xl font-bold mb-2">Calendar Feature is Disabled</h1>
                <p className="text-slate-600 text-center max-w-md">
                    The class scheduling and calendar features are currently disabled for this tenant.
                    Please contact an administrator to enable them in the tenant settings.
                </p>
            </div>
        );
    }`;

const replacement3 = `    if (calendarEnabled === null) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="w-8 h-8 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (calendarEnabled === false) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-900 font-sans p-6">
                <AlertTriangle className="w-12 h-12 text-yellow-500 mb-4" />
                <h1 className="text-2xl font-bold mb-2">Calendar Feature is Disabled</h1>
                <p className="text-slate-600 text-center max-w-md">
                    The class scheduling and calendar features are currently disabled for this tenant.
                    Please contact an administrator to enable them in the tenant settings.
                </p>
            </div>
        );
    }`;

if (content.includes(target1) && content.includes(target2) && content.includes(target3)) {
    content = content.replace(target1, replacement1);
    content = content.replace(target2, replacement2);
    content = content.replace(target3, replacement3);
    fs.writeFileSync(filePath, content);
    console.log("Successfully patched src/frontend/src/app/calendar/page.tsx with robust tri-state feature flag logic");
} else {
    console.log("Failed to find target strings to patch in src/frontend/src/app/calendar/page.tsx");
}
