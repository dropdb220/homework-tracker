'use client';

import Image from 'next/image';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocalStorage } from "usehooks-ts";

import { LSAccount, LSNewAccount } from "@/app/types";

export default function RegisterPassword() {
    const router = useRouter();

    const [pwd, setPwd] = useState('');
    const [passkeySupported, setPasskeySupported] = useState(false);
    const [goToPasskey, setGoToPasskey] = useState(false);
    const [errorMsg, setErrorMsg] = useState(' ');

    const [account, setAccount] = useLocalStorage<LSAccount | null>('account', null);
    const [newAccount, setNewAccount] = useLocalStorage<LSNewAccount | null>('newAccount', null);
    const [deviceLang, setDeviceLang] = useLocalStorage<number>('lang', 0);

    useEffect(() => {
        if (account && account.token && !goToPasskey) router.replace('/account');
    }, [account, router, goToPasskey]);

    useEffect(() => {
        if (window.PublicKeyCredential &&
            PublicKeyCredential.isConditionalMediationAvailable) {
            PublicKeyCredential.isConditionalMediationAvailable().then(result => {
                if (result) setPasskeySupported(true);
            });
        }
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
                    <h1 className="text-3xl ml-4">{newAccount?.id}</h1>
                    <div></div>
                </div>
            </div>
            <div className="lg:mt-24">
                <form onSubmit={e => {
                    e.preventDefault();
                    fetch('/api/account', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ id: newAccount?.id, pwd })

                    }).then(async res => {
                        if (res.ok) {
                            setErrorMsg('');
                            if (passkeySupported) setGoToPasskey(true);
                            setAccount({
                                id: newAccount!.id,
                                token: (await res.json()).token
                            });
                            setNewAccount({
                                id: newAccount!.id,
                                pwd,
                                authType: passkeySupported ? 'passkey' : 'password'
                            });
                            if (passkeySupported) router.push('/register/passkey');
                            else router.push('/');
                        } else {
                            res.json().then(data => {
                                setErrorMsg(data.msg);
                            });
                        }
                    });
                }}>
                    <input type="text" id="id" value={newAccount?.id} className="hidden" autoComplete="username" readOnly />
                    <input type="password" id="pwd" placeholder={deviceLang === 1 ? "Password" : "비밀번호"} className="border border-slate-400 h-12 rounded-lg p-4 w-[100%] dark:bg-[#424242]" autoComplete='new-password' autoFocus onChange={e => {
                        setPwd(e.currentTarget.value);
                        if (e.currentTarget.value.length < 8 || e.currentTarget.value.length > 4096) setErrorMsg(deviceLang === 1 ? "Please enter your password between 8 and 4096 characters." : '비밀번호는 8자 이상 4096자 이하로 입력하세요.');
                        else setErrorMsg('');
                    }} />
                    <br />
                    {errorMsg ? <p className="text-red-500">{errorMsg}</p> : <br />}
                    <br />
                    <br />
                    <button className="w-[40%] ml-[60%] mr-0 pt-3 pb-3 mt-4 rounded-lg bg-blue-500 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-800 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:hover:bg-gray-500 dark:disabled:hover:bg-gray-700 transition-all ease-in-out duration-200 focus:ring" type="submit" disabled={errorMsg !== ''}>
                        <span className="kor">다음</span>
                        <span className="eng">Next</span>
                    </button>
                </form>
            </div>
        </div>
    );
}