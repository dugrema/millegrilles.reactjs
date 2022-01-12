// https://koala42.com/using-webassembly-in-your-reactjs-app/
import { useEffect, useState } from 'react'
// import { ContextReplacementPlugin } from 'webpack'

function ChiffrageWasm(props) {

    const [wasmcrypto, setwasmcrypto] = useState()
    useEffect(()=>{
        loaddeps().then(deps=>{
            setwasmcrypto(deps.wasmcrypto)
        }).catch(err=>console.error("Erreur chargement wasmcrypto, %O", err))
    }, [])

    useEffect(()=>{
        if(wasmcrypto) {
            console.debug("WASM Crypto charge")
            // wasmcrypto.greet()
            chiffrer(wasmcrypto).catch(err=>console.error("Erreur wasmcrypto chiffrer: %O", err))
        }
    }, [wasmcrypto])

    return (
        <div>
            <h1>Chiffrage Wasm</h1>
        </div>
    )
}

export default ChiffrageWasm

async function loaddeps() {
    const wasmcrypto = await import('@dugrema/wasm-crypto/wasm_crypto.js')
    return {wasmcrypto}
}

async function chiffrer(wasmcrypto) {

    const nonce = new Uint8Array(19)
    await window.crypto.getRandomValues(nonce)
    var key = new Uint8Array(32)
    await window.crypto.getRandomValues(key)

    const messageString = "Je veux chiffrer un message avec WASM puis faire la difference entre WASM et pur JavaScript."
    const encoder = new TextEncoder()
    let messageBytes = encoder.encode(messageString)

    // const valeurs = [
    //     {done: false, value: Buffer.from([0, 1, 2, 3, 4])},
    //     {done: false, value: Buffer.from([5, 6, 7, 8])},
    //     {done: true, value: null},
    // ]

    const readstream = {
        read: async () => {
            if(!messageBytes) {
                return {done: true, value: null}
            }
            
            let value = messageBytes.slice(0, 5)
            // if(content.length < 5) {
            //     messageBytes = messageBytes.slice(5)
            // } else {
                messageBytes = null
            // }

            await new Promise(resolve=>setTimeout(resolve, 500))
            return {done: false, value}
        }
    }

    await wasmcrypto.xchacha20poly1305_chiffrer_stream(nonce, key, readstream)
    console.debug("Done chiffrage")
}