import comcigan from 'comcigan.js';
import i18n from '@/app/i18n.json';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    let clientLang = !isNaN(Number(request.headers.get('X-Lang') || undefined)) ? Number(request.headers.get('X-Lang')) : request.headers.get('Accept-Language')?.startsWith("en") ? 1 : 0;
    if (clientLang !== 0 && clientLang !== 1) clientLang = request.headers.get('Accept-Language')?.startsWith("en") ? 1 : 0;
    if (!process.env.COMCIGAN_SCHOOL || !process.env.COMCIGAN_GRADE || !process.env.COMCIGAN_CLASSNUM) {
        return new Response(JSON.stringify({ code: 1, msg: i18n.timetableNotSetUp[clientLang] }), { status: 500 });
    }
    try {
        const timetable = await comcigan.getTimetable(Number(process.env.COMCIGAN_SCHOOL), Number(process.env.COMCIGAN_GRADE), Number(process.env.COMCIGAN_CLASSNUM));
        return new Response(JSON.stringify({ data: timetable, code: 0 }), { status: 200 });
    } catch (e) {
        if (e instanceof comcigan.TimetableError)
        return new Response(JSON.stringify({ code: e.errorCode, msg: e.message }), { status: 500 });
    }
}
