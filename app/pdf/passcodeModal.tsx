import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

function LockoutCountdown({ retry }: { retry: number }) {
    const [tick, setTick] = useState(false);
    const [isClient, setIsClient] = useState(false);
    useEffect(() => {
        const intv = setInterval(() => {
            setTick(d => !d);
        }, 1000);
        return () => clearInterval(intv);
    }, []);
    useEffect(() => {
        setIsClient(true);
    }, []);

    return (
        <>
            <p className='kor text-lg'>{isClient ? (retry === -1 ? '관리자에게 연락' : `${Math.floor((retry - Date.now()) / 60 / 1000 + 1)}분 후에 다시 시도하십시오`) : ""}</p>
            <p className='eng text-lg'>{isClient ? (retry === -1 ? 'Contact Admin' : `Try again in ${Math.floor((retry - Date.now()) / 60 / 1000 + 1)} minute${Math.floor((retry - Date.now()) / 60 / 1000) === 0 ? '' : 's'}`) : ""}</p>
        </>
    )
}

export default function PasscodeModal({ token, setKey, setSalt, setIV, setDirEnc }: { token: string, setKey: React.Dispatch<React.SetStateAction<string | null>>, setSalt: React.Dispatch<React.SetStateAction<string | null>>, setIV: React.Dispatch<React.SetStateAction<string | null>>, setDirEnc: React.Dispatch<React.SetStateAction<string | null>> }) {
    const [input, setInput] = useState('');
    const [msg, setMsg] = useState('');
    const [lockout, setLockout] = useState(false);
    const [retry, setRetry] = useState(0);
    const [errorCnt, setErrorCnt] = useState(0);
    const [shake, setShake] = useState(false);
    const [canInput, setCanInput] = useState(true);
    const router = useRouter();

    useEffect(() => {
        if (input.length === 6) {
            setCanInput(false);
            fetch(`/api/pdf/dir`, {
                method: 'POST',
                headers: {
                    Authorization: token,
                    'X-Passcode': input
                }
            }).then(r => r.json()).then(async d => {
                setCanInput(true);
                setInput('');
                if (d.code === 1) {
                    setErrorCnt(d => d + 1);
                    setShake(true);
                    setTimeout(() => {
                        setShake(false);
                    }, 1000);
                    setMsg(d.error);
                    setTimeout(() => {
                        setErrorCnt(d => d - 1);
                    }, 3000);
                    setInput('');
                    return;
                } else if (d.code === 2) {
                    setShake(true);
                    setTimeout(() => {
                        setShake(false);
                    }, 1000);
                    if (d.lockout) {
                        setCanInput(false);
                        setLockout(true);
                        setRetry(d.retry);
                    }
                } else {
                    setSalt(d.salt);
                    setIV(d.dirIV);
                    setDirEnc(d.dirEnc);
                    setKey(d.key);
                }
            });
        }
    }, [input, errorCnt, setKey, setSalt, setIV, setDirEnc, token]);
    useEffect(() => {
        if (errorCnt <= 0) setMsg('');
    }, [errorCnt]);
    useEffect(() => {
        fetch('/api/pdf/lockout', {
            headers: {
                Authorization: token
            }
        }).then(r => {
            if (!r.ok) router.replace('/login');
            else {
                r.json().then(d => {
                    if (d.lockout) {
                        setLockout(true);
                        setRetry(d.retry);
                    }
                })
            }
        });
    }, [router, token]);
    useEffect(() => {
        const intv = setInterval(() => {
            if (lockout && Date.now() > retry) {
                setLockout(false);
                setCanInput(true);
                setRetry(0);
            }
        }, 1000);
        return () => clearInterval(intv);
    }, [lockout, retry]);
    useEffect(() => {
        const listener = (e: KeyboardEvent) => {
            if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(e.key) && input.length < 6) {
                setInput(input + e.key);
            } else if (e.key === 'Backspace') {
                if (input.length > 0) {
                    setInput(input.slice(0, -1));
                }
            }
        }
        if (canInput) window.addEventListener('keydown', listener);
        return () => {
            window.removeEventListener('keydown', listener);
        };
    }, [input, canInput]);

    return (
        <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center p-8 gap-16 sm:p-20 font-(family-name:--font-geist-sans)">
            <main className="flex flex-col gap-[32px] row-start-2 items-center">
                <h1 className="text-xl kor">{msg === '' ? '암호 입력' : msg}</h1>
                <h1 className="text-xl eng">{msg === '' ? 'Enter Passcode' : msg}</h1>
                <div className="flex flex-row gap-[16px] w-full sm:w-[400px] justify-center">
                    {
                        new Array(6).fill(0).map((_, idx) => (
                            <div key={idx} className={`border border-black dark:border-white rounded-full p-1 transition-[background-color] ${input.length > idx && 'bg-black dark:bg-white'} ${shake && 'animate-[shake_.5s_linear_1]'}`}></div>
                        ))
                    }
                </div>
                <br /><br />
                <div className="flex flex-row gap-[32px] w-full sm:w-[400px] justify-center">
                    {
                        new Array(3).fill(0).map((_, idx) => (
                            <div key={idx} tabIndex={0} onClick={() => { if (input.length < 6 && canInput) setInput(input + (idx + 1)) }} className="border border-black dark:border-white rounded-full p-6 max-w-14 max-h-14 flex flex-col items-center justify-center text-3xl transition-[background-color] duration-200 hover:bg-gray-600">{idx + 1}</div>
                        ))
                    }
                </div>
                <div className="flex flex-row gap-[32px] w-full sm:w-[400px] justify-center">
                    {
                        new Array(3).fill(0).map((_, idx) => (
                            <div key={idx} tabIndex={0} onClick={() => { if (input.length < 6 && canInput) setInput(input + (idx + 4)) }} className="border border-black dark:border-white rounded-full p-6 max-w-14 max-h-14 flex flex-col items-center justify-center text-3xl transition-[background-color] duration-200 hover:bg-gray-600">{idx + 4}</div>
                        ))
                    }
                </div>
                <div className="flex flex-row gap-[32px] w-full sm:w-[400px] justify-center">
                    {
                        new Array(3).fill(0).map((_, idx) => (
                            <div key={idx} tabIndex={0} onClick={() => { if (input.length < 6 && canInput) setInput(input + (idx + 7)) }} className="border border-black dark:border-white rounded-full p-6 max-w-14 max-h-14 flex flex-col items-center justify-center text-3xl transition-[background-color] duration-200 hover:bg-gray-600">{idx + 7}</div>
                        ))
                    }
                </div>
                <div className="flex flex-row gap-[32px] w-full sm:w-[400px] justify-center">
                    <div className="border border-black dark:border-white rounded-full p-6 max-w-14 max-h-14 flex flex-col items-center justify-center text-3xl opacity-0">0</div>
                    <div onClick={() => { if (input.length < 6 && canInput) setInput(input + '0'); }} className="border border-black dark:border-white rounded-full p-6 max-w-14 max-h-14 flex flex-col items-center justify-center text-3xl transition-[background-color] duration-200 hover:bg-gray-600">0</div>
                    <div className="w-14 h-14 text-center text-sm grid grid-rows-3">
                        <div></div>
                        <div className={`kor ${input === '' ? 'hidden' : ''}`} onClick={() => {
                            if (input.length > 0 && canInput) setInput(input.slice(0, -1));
                        }}>지우기</div>
                        <div className={`eng ${input === '' ? 'hidden' : ''}`} onClick={() => {
                            if (input.length > 0 && canInput) setInput(input.slice(0, -1));
                        }}>Delete</div>
                        <div></div>
                    </div>
                </div>
                <div className={`bg-black opacity-80 fixed top-0 left-0 w-full h-full z-10 ${!lockout && 'hidden'}`}></div>
                <div className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 text-center ${!lockout && 'hidden'}`}>
                    <h1 className='kor text-4xl'>{'다운로드을(를) 사용할 수 없음'}</h1>
                    <h1 className='eng text-4xl'>Download Unavailable</h1>
                    <LockoutCountdown retry={retry} />
                </div>
            </main>
        </div>
    );
}