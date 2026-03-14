import { AppProps } from 'next/app';
import '../styles/globals.css';
import { SessionProvider } from "next-auth/react"
import { useState } from 'react';
import getConfig from 'next/config'

import {PaasConfigProvider} from '../context/PaasConfig';

export default function App({ Component, pageProps: { session, ...pageProps }} : AppProps) {

  const { publicRuntimeConfig } = getConfig()
  // const [interval, setInterval] = useState(0);
  const [interval] = useState(0);

  return (
    <SessionProvider session={session} refetchInterval={interval} basePath={`${publicRuntimeConfig.basePath}/api/auth`}>
      <PaasConfigProvider>
        <Component {...pageProps} />
      </PaasConfigProvider>
    </SessionProvider>
  )
}
