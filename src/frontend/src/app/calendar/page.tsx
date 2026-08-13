"use client";

import React, { useState, useEffect } from "react";
import { Plus, Search, Filter, AlertTriangle, CheckCircle2, MapPin, Users, Info, ChevronLeft, ChevronRight, X } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

// Basic fallback if supabase env vars are missing
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy';
const supabase = createClient(supabaseUrl, supabaseKey);

// Custom Button Component
const Button = ({ children, variant, className, onClick, type = "button" }: any) => {
    const base = "px-4 py-2 rounded-md font-medium text-sm focus:outline-none transition-colors";
    const variants = {
        default: "bg-slate-900 text-white hover:bg-slate-800",
        outline: "border border-slate-300 text-slate-700 hover:bg-slate-50",
        ghost: "hover:bg-slate-100 text-slate-700",
        destructive: "bg-red-600 text-white hover:bg-red-700",
    };
    return (
        <button type={type} className={`${base} ${variants[variant as keyof typeof variants] || variants.default} ${className || ""}`} onClick={onClick}>
            {children}
        </button>
    );
};

const Input = ({ placeholder, type = "text", className, value, onChange, name, required }: any) => (
    <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        name={name}
        required={required}
        className={`border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none ${className || ""}`}
    />
);

const Badge = ({ children, variant }: any) => {
    const variants = {
        default: "bg-slate-900 text-white",
        success: "bg-green-100 text-green-800",
        warning: "bg-yellow-100 text-yellow-800",
        destructive: "bg-red-100 text-red-800",
        purple: "bg-purple-100 text-purple-800",
        blue: "bg-blue-100 text-blue-800"
    };
    return (
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${variants[variant as keyof typeof variants] || variants.default}`}>
            {children}
        </span>
    );
};

export default function CalendarPage() {
    const [schedules, setSchedules] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showConflictModal, setShowConflictModal] = useState(false);
    const [conflictDetails, setConflictDetails] = useState<any>(null);
    const [showScheduleForm, setShowScheduleForm] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        trainer_id: '',
        facility_id: '',
        start_time: '',
        end_time: '',
        capacity_override: ''
    });

    const [trainers, setTrainers] = useState<any[]>([]);
    const [facilities, setFacilities] = useState<any[]>([]);

    const [currentTenantId, setCurrentTenantId] = useState<string>('');
    const [calendarEnabled, setCalendarEnabled] = useState<boolean | null>(null);
    const [waitlistEnabled, setWaitlistEnabled] = useState<boolean>(false);
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [selectedClass, setSelectedClass] = useState<any>(null);
    const [memberBookings, setMemberBookings] = useState<any[]>([]);
    const [waitlistData, setWaitlistData] = useState<any[]>([]);

    useEffect(() => {
        const getUser = async () => {
            try {
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                if (authError || !user) {
                    setCalendarEnabled(false);
                    return;
                }
                setCurrentUserId(user.id);
                const { data, error: profileError } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
                if (profileError || !data) {
                    setCalendarEnabled(false);
                    return;
                }

                setCurrentTenantId(data.tenant_id);
                const { data: tenantData, error: tenantError } = await supabase.from('tenants').select('calendar_enabled, waitlist_enabled').eq('id', data.tenant_id).single();

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
    }, []);

    useEffect(() => {
        fetchSchedules();
        fetchResources();
    }, []);


    const fetchMemberBookings = async (tenantId: string, profileId: string) => {
        const { data } = await supabase
            .from('class_bookings')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('profile_id', profileId)
            .in('status', ['booked', 'checked_in']);
        if (data) setMemberBookings(data);
    };

    const fetchWaitlistData = async (tenantId: string, profileId: string) => {
        const { data } = await supabase
            .from('waitlists')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('profile_id', profileId)
            .eq('status', 'waiting');
        if (data) setWaitlistData(data);
    };

    const fetchBookingsCount = async () => {
        // Dummy implementation to re-fetch schedules which could contain the counts
        fetchSchedules();
    };

    const fetchSchedules = async () => {
        setLoading(true);
        // We'll mock the data for now since we don't have real data populated
        const mockClasses = [
            { id: '1', title: 'Power Yoga', trainer: { first_name: 'Coach Mark' }, facility: { name: 'Yoga Hall' }, start_time: '2026-08-14T08:00:00Z', end_time: '2026-08-14T09:00:00Z', capacity_override: 20 },
            { id: '2', title: 'CrossFit WOD', trainer: { first_name: 'Coach Shauna' }, facility: { name: 'Main Floor' }, start_time: '2026-08-15T10:00:00Z', end_time: '2026-08-15T11:00:00Z', capacity_override: 25 },
        ];

        try {
            const { data, error } = await supabase
                .from('class_schedules')
                .select('*, trainer:profiles(first_name, last_name), facility:facilities(name, max_capacity), class_bookings(count)')
                .eq('is_cancelled', false)
                .in('class_bookings.status', ['booked', 'checked_in']);

            if (data && data.length > 0) {
                 setSchedules(data);
            } else {
                 setSchedules(mockClasses); // Use mock if empty DB
            }
        } catch (e) {
            setSchedules(mockClasses);
        }
        setLoading(false);
    };

    const fetchResources = async () => {
        const { data: tData } = await supabase.from('profiles').select('*').in('role', ['staff', 'admin', 'trainer']);
        const { data: fData } = await supabase.from('facilities').select('*');
        if(tData) setTrainers(tData);
        if(fData) setFacilities(fData);
    };

    const handleInputChange = (e: any) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleScheduleSubmit = async (e: any) => {
        e.preventDefault();

        // 1. Validate schedule via backend API
        try {
            const response = await fetch('/api/calendar/validate-schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenant_id: currentTenantId, // Use real tenant in production
                    start_time: formData.start_time,
                    end_time: formData.end_time,
                    trainer_id: formData.trainer_id,
                    facility_id: formData.facility_id
                })
            });

            if (!response.ok) {
                 console.error("API error");
                 // fallback if API is not available
            } else {
                const data = await response.json();

                if (!data.valid) {
                    setConflictDetails({
                        conflicts: data.conflicts,
                        recommendations: data.recommendations
                    });
                    setShowConflictModal(true);
                    return; // Stop submission
                }
            }

            // 2. If valid (or backend unavailable but we want to proceed)
            saveClassSchedule(formData);

        } catch (error) {
            console.error("Error validating schedule:", error);
            // In a real app we might show a generic error, here we try saving directly if validation fails
            saveClassSchedule(formData);
        }
    };

    const saveClassSchedule = async (data: any) => {
        const { error } = await supabase.from('class_schedules').insert({
            tenant_id: currentTenantId,
            title: data.title,
            trainer_id: data.trainer_id || null,
            facility_id: data.facility_id || null,
            start_time: data.start_time,
            end_time: data.end_time,
            capacity_override: parseInt(data.capacity_override) || null
        });

        if (error) {
            alert(`Error saving class: ${error.message}`);
        } else {
            setShowScheduleForm(false);
            setFormData({ title: '', trainer_id: '', facility_id: '', start_time: '', end_time: '', capacity_override: '' });
            fetchSchedules();
        }
    };


    const handleJoinWaitlist = async (cls: any) => {
        if (!currentUserId || !currentTenantId) return;
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/calendar/join-waitlist`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
            },
            body: JSON.stringify({
                tenant_id: currentTenantId,
                schedule_id: cls.id,
                profile_id: currentUserId
            })
        });
        if (res.ok) {
            alert('Joined waitlist');
            fetchWaitlistData(currentTenantId, currentUserId);
            setSelectedClass(null);
        } else {
            alert('Error joining waitlist');
        }
    };

    const handleCancelBooking = async (cls: any) => {
        if (!currentUserId || !currentTenantId) return;
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/calendar/cancel-booking`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
            },
            body: JSON.stringify({
                tenant_id: currentTenantId,
                schedule_id: cls.id,
                profile_id: currentUserId
            })
        });
        if (res.ok) {
            alert('Booking cancelled');
            fetchMemberBookings(currentTenantId, currentUserId);
            fetchSchedules();
            setSelectedClass(null);
        } else {
            alert('Error cancelling booking');
        }
    };

    const handleBookClass = async (cls: any) => {
        if (!currentUserId || !currentTenantId) return;
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/calendar/book`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
            },
            body: JSON.stringify({
                tenant_id: currentTenantId,
                schedule_id: cls.id,
                profile_id: currentUserId
            })
        });
        if (res.ok) {
            alert('Booked successfully');
            fetchMemberBookings(currentTenantId, currentUserId);
            fetchSchedules();
            setSelectedClass(null);
        } else {
            const data = await res.json();
            alert(`Error booking class: ${data.error}`);
        }
    };

    const resolveConflict = (recommendedTrainerId?: string, recommendedFacilityId?: string) => {
        const updatedData = { ...formData };
        if (recommendedTrainerId) updatedData.trainer_id = recommendedTrainerId;
        if (recommendedFacilityId) updatedData.facility_id = recommendedFacilityId;

        setShowConflictModal(false);
        setConflictDetails(null);

        // Save with new recommendations
        saveClassSchedule(updatedData);
    };

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const timeSlots = ['06:00 AM', '07:00 AM', '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM', '07:00 PM', '08:00 PM'];

    if (calendarEnabled === null) {
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
    }

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans">
            {/* Top Bar */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center space-x-4">
                    <h1 className="text-xl font-bold tracking-tight text-slate-900">Tactical Calendar & Resource Matrix</h1>
                    <Badge variant="success">Sync Active</Badge>
                </div>
                <div className="flex items-center space-x-3">
                    <div className="flex items-center border border-slate-200 rounded-md p-1">
                        <Button variant="ghost" className="px-2 py-1"><ChevronLeft className="w-4 h-4" /></Button>
                        <span className="text-sm font-medium px-4">Aug 14 - Aug 20, 2026</span>
                        <Button variant="ghost" className="px-2 py-1"><ChevronRight className="w-4 h-4" /></Button>
                    </div>
                    <Button onClick={() => setShowScheduleForm(true)} className="flex items-center">
                        <Plus className="w-4 h-4 mr-2" /> Schedule Class
                    </Button>
                </div>
            </header>

            {/* Filter Toolbar */}
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
                <div className="flex space-x-3">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        <Input placeholder="Search classes, trainers..." className="pl-9 w-64" />
                    </div>
                    <Button variant="outline" className="flex items-center"><Filter className="w-4 h-4 mr-2" /> Room</Button>
                    <Button variant="outline" className="flex items-center"><Filter className="w-4 h-4 mr-2" /> Instructor</Button>
                    <Button variant="outline" className="flex items-center"><Filter className="w-4 h-4 mr-2" /> Type</Button>
                </div>
                <div className="flex items-center space-x-2 text-sm text-slate-500 font-medium">
                    <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-purple-400 mr-1"></div> Yoga</div>
                    <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-blue-400 mr-1"></div> Strength</div>
                    <div className="flex items-center"><div className="w-3 h-3 rounded-full bg-yellow-400 mr-1"></div> Cardio</div>
                </div>
            </div>

            {/* Main Calendar Grid */}
            <main className="flex-1 overflow-auto p-6">
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[800px]">

                    {/* Header Row */}
                    <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50">
                        <div className="p-3 border-r border-slate-200 text-xs font-semibold text-slate-500 text-center uppercase tracking-wider">Time</div>
                        {days.map((day, i) => (
                            <div key={day} className="p-3 border-r border-slate-200 text-center">
                                <div className="text-sm font-semibold text-slate-900">{day}</div>
                                <div className="text-xs text-slate-500">Aug {14 + i}</div>
                            </div>
                        ))}
                    </div>

                    {/* Grid Body */}
                    <div className="flex-1 overflow-y-auto relative bg-slate-50">

                        {/* Off-peak visual marker layer (e.g. 11am-3pm) */}
                        <div className="absolute top-[250px] h-[200px] left-[12.5%] right-0 bg-slate-200/50 border-y-2 border-slate-300 pointer-events-none z-0 flex items-center justify-center">
                             <div className="bg-slate-700 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center opacity-70">
                                 <AlertTriangle className="w-3 h-3 mr-1" /> Off-Peak Protocol: Automated Access Restricted
                             </div>
                        </div>

                        {timeSlots.map((time, timeIdx) => (
                            <div key={time} className="grid grid-cols-8 border-b border-slate-200 h-[50px]">
                                <div className="p-2 border-r border-slate-200 text-xs font-medium text-slate-500 text-right pr-4 bg-white relative z-10">
                                    {time}
                                </div>
                                {days.map((day, dayIdx) => (
                                    <div key={`${time}-${day}`} className="border-r border-slate-100 relative p-1">
                                        {/* Simplified Class Rendering based on time matching */}
                                        {schedules.map(cls => {
                                            const d = new Date(cls.start_time);
                                            // Super basic matching for visual demo. In a real app we'd map timestamps to grid slots.
                                            let clsHour = d.getHours();
                                            let isAM = clsHour < 12;
                                            let hour12 = clsHour % 12 || 12;
                                            let timeStr = `${hour12 < 10 ? '0' + hour12 : hour12}:00 ${isAM ? 'AM' : 'PM'}`;

                                            // Hardcode day 1 and 2 for demo if mock
                                            let clsDayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1; // 0 is Monday here

                                            if (cls.day !== undefined) clsDayIdx = cls.day; // Support mock day property

                                            if (clsDayIdx === dayIdx && timeStr === time) {
                                                return (
                                                    <div key={cls.id} onClick={() => setSelectedClass(cls)} className={`absolute top-1 left-1 right-1 z-10 rounded-md p-2 border shadow-sm bg-purple-50 border-purple-200 h-[40px] flex items-center justify-between overflow-hidden group cursor-pointer hover:shadow-md transition-shadow`}>
                                                        <div>
                                                            <div className="text-xs font-bold text-slate-900 truncate">{cls.title}</div>
                                                            <div className="text-[10px] text-slate-600 flex items-center truncate">
                                                                <Users className="w-3 h-3 mr-1" /> {cls.trainer?.first_name || 'Staff'}
                                                            </div>
                                                        </div>
                                                        <div className="text-[10px] font-semibold bg-white px-1.5 py-0.5 rounded-sm border border-slate-200">
                                                            {cls.class_bookings?.[0]?.count || 0}/{cls.capacity_override || cls.facility?.max_capacity || 20}
                                                        </div>
                                                    </div>
                                                )
                                            }
                                            return null;
                                        })}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </main>

            {/* Schedule Form Modal */}
            {showScheduleForm && (
                <div className="fixed inset-0 bg-slate-900/50 z-40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative">
                        <button onClick={() => setShowScheduleForm(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                            <X className="w-5 h-5" />
                        </button>
                        <h2 className="text-xl font-bold mb-4">Schedule Class</h2>
                        <form onSubmit={handleScheduleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Class Title</label>
                                <Input name="title" value={formData.title} onChange={handleInputChange} required className="w-full" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Start Time</label>
                                    <Input type="datetime-local" name="start_time" value={formData.start_time} onChange={handleInputChange} required className="w-full" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">End Time</label>
                                    <Input type="datetime-local" name="end_time" value={formData.end_time} onChange={handleInputChange} required className="w-full" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Trainer ID</label>
                                    <Input name="trainer_id" value={formData.trainer_id} onChange={handleInputChange} placeholder="uuid" className="w-full" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Facility ID</label>
                                    <Input name="facility_id" value={formData.facility_id} onChange={handleInputChange} placeholder="uuid" className="w-full" />
                                </div>
                            </div>
                            <div className="flex justify-end pt-4">
                                <Button type="submit">Validate & Schedule</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Smart Resource Conflict Resolver Modal */}
            {showConflictModal && (
                <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="bg-red-50 border-b border-red-100 p-4 flex items-start space-x-3">
                            <div className="bg-red-100 p-2 rounded-full mt-1">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-red-900">Resource Conflict Detected</h3>
                                {conflictDetails?.conflicts?.map((c: any, idx: number) => (
                                    <p key={idx} className="text-sm text-red-700 mt-1">{c.message}</p>
                                ))}
                            </div>
                        </div>
                        <div className="p-6">
                            <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center">
                                <Info className="w-4 h-4 mr-2 text-blue-500" /> Co-Founder AI Recommendation
                            </h4>
                            <div className="border border-blue-100 bg-blue-50/50 rounded-lg p-4 space-y-3">
                                <p className="text-sm text-slate-700">
                                    To maintain service quality without delaying scheduling:
                                </p>

                                {conflictDetails?.recommendations?.trainers && conflictDetails.recommendations.trainers.length > 0 && (
                                    <div className="bg-white border border-slate-200 rounded-md p-3 flex items-center justify-between mb-2">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
                                                {conflictDetails.recommendations.trainers[0].first_name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-slate-900">
                                                    {conflictDetails.recommendations.trainers[0].first_name} {conflictDetails.recommendations.trainers[0].last_name}
                                                </div>
                                                <div className="text-xs text-green-600 font-medium">Available & Qualified Trainer</div>
                                            </div>
                                        </div>
                                        <Button variant="outline" size="sm" onClick={() => resolveConflict(conflictDetails.recommendations.trainers[0].id, undefined)}>Assign</Button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-end space-x-3">
                            <Button variant="ghost" onClick={() => setShowConflictModal(false)}>Cancel Action</Button>
                            <Button variant="destructive" onClick={() => saveClassSchedule(formData)}>Force Overwrite (Admin Only)</Button>
                        </div>
                    </div>
                </div>
            )}

            {selectedClass && (
                <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative">
                        <button onClick={() => setSelectedClass(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                            <X className="w-5 h-5" />
                        </button>
                        <h2 className="text-xl font-bold mb-4">{selectedClass.title}</h2>
                        <div className="space-y-4">
                            <p className="text-sm"><strong>Trainer:</strong> {selectedClass.trainer?.first_name} {selectedClass.trainer?.last_name}</p>
                            <p className="text-sm"><strong>Facility:</strong> {selectedClass.facility?.name}</p>
                            <p className="text-sm"><strong>Capacity:</strong> {selectedClass.class_bookings?.[0]?.count || 0}/{selectedClass.capacity_override || selectedClass.facility?.max_capacity || 20}</p>

                            <div className="flex justify-end pt-4 space-x-2">
                                {memberBookings.some(b => b.schedule_id === selectedClass.id) ? (
                                    <Button variant="destructive" onClick={() => handleCancelBooking(selectedClass)}>Cancel Booking</Button>
                                ) : (
                                    <>
                                        {((selectedClass.class_bookings?.[0]?.count || 0) >= (selectedClass.capacity_override || selectedClass.facility?.max_capacity || 20)) ? (
                                            waitlistEnabled ? (
                                                waitlistData.some(w => w.schedule_id === selectedClass.id) ? (
                                                    <Button disabled variant="outline">On Waitlist</Button>
                                                ) : (
                                                    <Button onClick={() => handleJoinWaitlist(selectedClass)}>Join Waitlist</Button>
                                                )
                                            ) : (
                                                <Button disabled variant="outline">Class Full</Button>
                                            )
                                        ) : (
                                            <Button onClick={() => handleBookClass(selectedClass)}>Book Class</Button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
