import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function ImageModal({ src, children, className }: { src: string, children: React.ReactNode, className?: string }) {
    const [displayed, setDisplayed] = useState(false);

    useEffect(() => {
        if (src.startsWith('/') && !src.startsWith('//')) {
            fetch(src).catch(() => { }); // cache original image to service worker
        }
    }, [src]);

    return (
        <div className={className}>
            <button className="block w-full" onClick={e => setDisplayed(true)}>
                {children}
            </button>
            {displayed &&
                <>
                    <button className="fixed top-0 left-0 w-full h-full bg-black opacity-50 z-50" onClick={e => setDisplayed(false)}>
                    </button>
                    <div className="fixed top-[50%] left-[50%] transform translate-x-[-50%] translate-y-[-50%] z-50">
                        <Link href={src} target="_blank">
                            {(src.startsWith('/') && !src.startsWith('//'))
                                ? <Image src={src} alt={src} width={5000} height={5000} className="w-auto max-w-[90vw] max-h-screen" />
                                // eslint-disable-next-line @next/next/no-img-element
                                : <img src={src} alt={src} className="w-auto max-w-[90vw] max-h-screen" />
                            }
                        </Link>
                    </div>
                </>
            }
        </div>
    );
}