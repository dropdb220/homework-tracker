'use client';

import Image from "next/image";
import Link from "next/link";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocalStorage } from "usehooks-ts";

import { LSAccount, Time, permToString, langToString, AccountFlag } from "@/app/types";
import _i18n from "@/app/i18n.json";
const i18n: { [key: string]: string | string[] } = _i18n;

function SelectModal(props: { list: string[] | null, defaultValue: string, onSelect: (value: string) => void, onClose: () => void, children: React.ReactNode, className?: string }) {
    const [currentSelection, setCurrentSelection] = useState(props.defaultValue);
    const [show, setShow] = useState(false);

    return (
        <>
            <div onClick={() => { setShow(true); }}>{props.children}</div>
            <div className={`fixed top-0 left-0 w-full h-full bg-black opacity-50 z-900 ${show ? "block" : "hidden"}`} onClick={() => { setShow(false); props.onClose(); }}></div>
            <div className={`overflow-auto fixed top-0 left-0 w-full h-full opacity-100 flex items-start justify-center z-1000 ${show ? "block" : "hidden"}`} onClick={() => { setShow(false); props.onClose(); }}>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mt-8" onClick={(e) => e.stopPropagation()}>
                    {(props.list ?? []).map((item, index) => (
                        <button key={index} className="block w-full text-left px-4 py-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded" onClick={() => { setShow(false); setCurrentSelection(item); props.onSelect(item); props.onClose(); }}>
                            {currentSelection === item ? '✓ ' : ''} {item}
                        </button>
                    ))}
                </div>
            </div>
        </>
    );
}

export default function MyAccountInfoPage() {
    const router = useRouter();
    const [timetable, setTimetable] = useState<Array<Array<Time>> | null>(null);
    const [subjects, setSubjects] = useState<{ [key: string]: string } | null>(null);
    const [allSubjects, setAllSubjects] = useState<string[] | null>(null);
    const [isClient, setIsClient] = useState(false);
    const [saveState, setSaveState] = useState('');
    const [saveErrorMsg, setSaveErrorMsg] = useState('');
    const [isOffline, setIsOffline] = useState(false);
    const [notification, setNotification] = useLocalStorage<any>('notification', null);
    const [deviceLang, setDeviceLang] = useLocalStorage<number>('lang', 0);
    const [encv2prf, setEncv2prf] = useLocalStorage<boolean>('encv2prf', false);

    const [account, setAccount] = useLocalStorage<LSAccount | null>('account', null);

    useEffect(() => {
        setIsClient(true);
    }, []);
    useEffect(() => {
        if (!isClient) return;
        if (account && account.id && account.token) {
            fetch('/api/account/timetable', {
                headers: {
                    Authorization: account.token
                }
            }).then(async res => {
                if (res.ok) {
                    const d = (await res.json()).data;
                    setTimetable(d.timetable);
                    setSubjects(d.subjects);
                    setAllSubjects(d.all_subjects);
                } else {
                    setAccount(null);
                    router.replace('/login/id');
                }
            }).catch(() => {
                setIsOffline(true);
            })
        } else {
            router.replace('/login/id');
        }
    }, [account, isClient, router, setAccount, isOffline]);
    useEffect(() => {
        if (isOffline) {
            const interval = setInterval(() => {
                fetch('/api/is_online').then(() => {
                    setIsOffline(false);
                }).catch(() => {
                    setIsOffline(true);
                });
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [isOffline]);

    return isOffline ? (
        <>
            <div className="kor">
                <Image src="/offline.svg" alt="오프라인 상태" width={150} height={150} className="mt-2 mb-8 ml-auto mr-auto dark:invert" />
                <h2>오프라인 상태입니다.</h2>
                <p>시간표를 확인하려면 인터넷 연결이 필요합니다.</p>
            </div>
            <div className="eng">
                <Image src="/offline.svg" alt="Offline" width={150} height={150} className="mt-2 mb-8 ml-auto mr-auto dark:invert" />
                <h2>You{'\''}re offline.</h2>
                <p>An active internet connection is required to view your timetable.</p>
            </div>
        </>
    ) : (
        <div className="w-full lg:w-[80%] md:grid md:grid-cols-2 md:gap-2 ml-auto mr-auto">
            <div className="mb-4 lg:mt-24">
                <div className="grid grid-cols-[auto_auto_1fr]">
                    <button onClick={(e) => {
                        e.preventDefault();
                        router.back();
                    }}><Image src="/back.svg" alt="뒤로가기" height={36} width={36} className="relative mt-[.125rem] dark:invert w-9 h-9" /></button>
                    <h1 className="text-3xl ml-4 kor">시간표</h1>
                    <h1 className="text-3xl ml-4 eng">Timetable</h1>
                    <div></div>
                </div>
            </div>
            <div className="lg:mt-24">
                <>
                    <span className={`kor text-right float-right whitespace-pre-line ${saveState === '저장됨' && 'text-green-500'} ${saveState === '저장 실패' && 'text-red-500'}`} >{saveState}{saveState === '저장 실패' && `\n${saveErrorMsg}`}</span>
                    <span className={`eng text-right float-right whitespace-pre-line ${saveState === 'Saved' && 'text-green-500'} ${saveState === 'Failed to Save' && 'text-red-500'}`} >{saveState}{saveState === 'Failed to Save' && `\n${saveErrorMsg}`}</span>
                    <br /><br /><br />
                    {timetable ? <div className={`grid grid-cols-5`}>
                        {timetable.map((day, index) => (
                            <div key={index} className="border rounded-lg p-2">
                                <h2 className="text-lg text-center font-bold mb-2">{i18n[`day${index}`][deviceLang]}</h2>
                                {day.map((time, timeIndex) => (
                                    <div key={timeIndex} className={`p-2 mb-4 rounded ${time.fixed ? 'bg-gray-300 dark:bg-gray-700' : 'bg-blue-300 dark:bg-blue-700'}`}>
                                        {time.fixed ? <>{time.name}</> : (
                                            <SelectModal list={allSubjects} defaultValue={subjects![time.time!]} onSelect={(item) => {
                                                setSaveState(deviceLang === 1 ? 'Saving...' : '저장 중');
                                                fetch('/api/account/timetable', {
                                                    method: 'PUT',
                                                    headers: {
                                                        'Content-Type': 'application/json',
                                                        Authorization: account?.token || ''
                                                    },
                                                    body: JSON.stringify({
                                                        changes: [{
                                                            time: time.time,
                                                            subject: item
                                                        }]
                                                    })
                                                }).then(async res => {
                                                    if (res.ok) {
                                                        setSaveState(deviceLang === 1 ? 'Saved' : '저장됨');
                                                        setTimetable((prev: Array<Array<Time>> | null) => {
                                                            return prev?.map(day => day.map(t => {
                                                                if (!t.fixed && t.time === time.time) return { ...t, name: item };
                                                                else return t;
                                                            })) ?? null;
                                                        })
                                                        setSubjects((prev: { [key: string]: string } | null) => {
                                                            return { ...prev, [time.time!]: item };
                                                        });
                                                    } else {
                                                        setSaveState(deviceLang === 1 ? 'Failed to Save' : '저장 실패');
                                                        setSaveErrorMsg((await res.json()).msg);
                                                    }
                                                }).catch(() => {
                                                    setSaveState(deviceLang === 1 ? 'Failed to Save' : '저장 실패');
                                                    setSaveErrorMsg(deviceLang === 1 ? 'You\'re Offline' : '오프라인 상태');
                                                });
                                            }} onClose={() => { }}>
                                                {time.name}
                                            </SelectModal>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div> : (
                        <>
                            <p className="kor">불러오는 중...</p>
                            <p className="eng">Loading...</p>
                        </>
                    )}
                </>
            </div>
        </div>
    );
}