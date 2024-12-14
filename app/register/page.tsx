'use client';

import Image from 'next/image';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocalStorage } from "usehooks-ts";

import { LSAccount, LSNewAccount } from "@/app/types";

export default function Register() {
    const router = useRouter();

    const [id, setId] = useState('');
    const [duplicateID, setDuplicateID] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [isClient, setIsClient] = useState<boolean>(false);

    const [account, setAccount] = useLocalStorage<LSAccount | null>('account', null);
    const [newAccount, setNewAccount] = useLocalStorage<LSNewAccount | null>('newAccount', null);
    const [deviceLang, setDeviceLang] = useLocalStorage<number>('lang', 0);

    if (account && account.token) router.replace('/account');

    useEffect(() => {
        setIsClient(true);
    }, []);

    return (
        <div className="w-full lg:w-[80%] md:grid md:grid-cols-2 md:gap-2 ml-auto mr-auto">
            <div className="mb-4 lg:mt-24">
                <div className="grid grid-cols-[auto_auto_1fr]">
                    <button onClick={(e) => {
                        e.preventDefault();
                        router.back();
                    }}>
                        <Image src="/back.svg" alt="뒤로가기" height={36} width={36} className="kor relative mt-[.125rem] dark:invert w-9 h-9" />
                        <Image src="/back.svg" alt="Back" height={36} width={36} className="eng relative mt-[.125rem] dark:invert w-9 h-9" />
                    </button>
                    <h1 className="text-3xl ml-4">
                        <span className="kor">계정 생성</span>
                        <span className="eng">Create Account</span>
                    </h1>
                    <div></div>
                </div>
            </div>
            <div className="lg:mt-24">
                <form onSubmit={e => {
                    e.preventDefault();
                    if (!id || id.length > 20 || id.length < 4) {
                        setErrorMsg(deviceLang === 1 ? "Please enter your ID between 4 and 20 characters." : '아이디는 4자 이상 20자 이하로 입력하세요.');
                        return;
                    }
                    fetch('/api/check_id?id=' + encodeURIComponent(id)).then(async res => {
                        if (res.status === 404) {
                            setDuplicateID(false);
                            setErrorMsg('');
                            setNewAccount({
                                id,
                                authType: 'password'
                            });
                            router.push(`/register/password`);
                        } else if (res.ok) {
                            setDuplicateID(true);
                        } else {
                            res.json().then(data => {
                                setErrorMsg(data.msg);
                            });
                        }
                    });
                }}>
                    <input type="text" id="id" placeholder="아이디" className="border border-slate-400 h-12 rounded-lg p-4 w-[100%] dark:bg-[#424242]" autoComplete='username' autoFocus onChange={e => {
                        setId(e.currentTarget.value);
                        setDuplicateID(false);
                        fetch('/api/check_id?id=' + encodeURIComponent(e.currentTarget.value)).then(async res => {
                            if (res.status === 404) {
                                setDuplicateID(false);
                                setErrorMsg('');
                            } else if (res.ok) {
                                setDuplicateID(true);
                            } else {
                                res.json().then(data => {
                                    setErrorMsg(data.msg);
                                });
                            }
                        });
                    }} />
                    <br />
                    {(errorMsg !== '' || duplicateID) ? <p className="text-red-500">{errorMsg === '' ? ((deviceLang === 1 && isClient) ? "The ID is already in use." : '이미 사용 중인 아이디입니다.') : errorMsg}</p> : <br />}
                    <br />
                    <br />
                    <button className="w-[40%] ml-[60%] mr-0 pt-3 pb-3 mt-4 rounded-lg bg-blue-500 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring" type="submit" disabled={duplicateID || errorMsg !== ''}>
                        <span className="kor">다음</span>
                        <span className="eng">Next</span>
                    </button>
                </form>
            </div>
        </div>
    );
}