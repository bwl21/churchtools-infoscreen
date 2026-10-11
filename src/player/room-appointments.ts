import { selectUpcoming, type Appointment } from '../appointments/normalize';
import { startOfZonedDay, zonedDateKey } from '../appointments/zoned';
import { tp } from '../i18n/player';
import type { Block } from '../model/schema';
import { formatShortDate } from './format';
import { SHOW_ALL_CAP } from './paging';

export type RoomAppointments = Extract<Block, { type: 'room-appointments' }>;

/** Filter before the limit: earlier appointments in other rooms must not hide matching ones. */
export function roomAppointments(appointments: Appointment[], block: RoomAppointments, now: Date, timeZone: string): Appointment[] {
    const rooms = new Set(block.roomIds);
    return selectUpcoming(appointments.filter((a) => !a.bookedRooms?.length || a.bookedRooms.some((r) => rooms.has(r.id))), {
        now, timeZone, calendarIds: block.calendarIds, horizonDays: block.horizonDays, limit: SHOW_ALL_CAP,
    });
}

export function roomAppointmentDay(appointment: Appointment, now: Date, timeZone: string): string {
    if (appointment.startDate === zonedDateKey(now, timeZone)) return tp.appointments.today;
    if (appointment.startDate === zonedDateKey(startOfZonedDay(now, timeZone, 1), timeZone)) return tp.time.tomorrow;
    return formatShortDate(appointment.start, timeZone).replace('.', '');
}
