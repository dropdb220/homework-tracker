'use client';

import Link from 'next/link';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocalStorage } from "usehooks-ts";

import { LSAccount } from "@/app/types";

export default function RegisterEnc() {
    const router = useRouter();

    const [passcode, setPasscode] = useState('');
    const [newPasscode, setNewPasscode] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveState, setSaveState] = useState('');
    const [saveErrorMsg, setSaveErrorMsg] = useState('');

    const [account, setAccount] = useLocalStorage<LSAccount | null>('account', null);
    const [deviceLang, setDeviceLang] = useLocalStorage<number>('lang', 0);

    useEffect(() => {
        if (!account || !account.token) {
            router.replace('/login');
        }
    }, [router, account]);

    return (
        <div className="w-full lg:w-[80%] md:grid md:grid-cols-2 md:gap-2 ml-auto mr-auto">
            <div className="mb-4 lg:mt-24">
                <h1 className="text-3xl kor">암호 변경하기</h1>
                <h1 className="text-3xl eng">Change Passcode</h1>
            </div>
            <div className="lg:mt-24">
                <label htmlFor="passcode" className="kor">{'기존 암호(숫자 6자리)'}</label>
                <label htmlFor="passcode" className="eng">{'Old passcode(6-digit numeric)'}</label>
                <br />
                <input type="text" id="passcode" value={passcode} className="border border-slate-400 h-12 rounded-lg p-4 w-[70%] dark:bg-[#424242] [-webkit-text-security:disc]" onChange={e => {
                    if (e.currentTarget.value === '' || /[0-9]+/.test(e.currentTarget.value) && e.currentTarget.value.length <= 6) setPasscode(e.currentTarget.value);
                }} />
                <br /><br />
                <label htmlFor="newpasscode" className="kor">{'새 암호(숫자 6자리)'}</label>
                <label htmlFor="newpasscode" className="eng">{'New passcode(6-digit numeric)'}</label>
                <br />
                <input type="text" id="newpasscode" value={newPasscode} className="border border-slate-400 h-12 rounded-lg p-4 w-[70%] dark:bg-[#424242] [-webkit-text-security:disc]" onChange={e => {
                    if (e.currentTarget.value === '' || /[0-9]+/.test(e.currentTarget.value) && e.currentTarget.value.length <= 6) setNewPasscode(e.currentTarget.value);
                }} />
                <br /><br />
                <button disabled={saving} className="w-[20%] mr-0 pt-3 pb-3 mt-4 rounded-lg bg-blue-500 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring-3" onClick={e => {
                        e.preventDefault();
                        setSaving(true);
                        fetch('/api/pdf/change', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: account!.token! },
                            body: JSON.stringify({
                                passcode,
                                newPasscode
                            })
                        }).then(async res => {
                            if (res.ok) {
                                router.push('/pdf');
                            } else {
                                setSaving(false);
                                setSaveState('저장 실패');
                                setSaveErrorMsg((await res.json()).msg);
                            }
                        }).catch(() => {
                            setSaving(false);
                            setSaveState('저장 실패');
                            setSaveErrorMsg(deviceLang === 1 ? 'You\'re Offline' : '오프라인 상태');
                        });
                    }}>
                        <span className="kor">저장</span>
                        <span className="eng">Save</span>
                    </button>
                    <br />
                    {saveState !== '' && <div className="text-red-500">{saveErrorMsg}</div>}
            </div>
        </div>
    );
}