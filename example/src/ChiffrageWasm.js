// https://koala42.com/using-webassembly-in-your-reactjs-app/
import { useEffect, useState } from 'react'

function ChiffrageWasm(props) {

    const [wasmcrypto, setwasmcrypto] = useState()
    useEffect(()=>{
        loaddeps().then(deps=>{
            setwasmcrypto(deps.wasmcrypto)
        })
    }, [])

    useEffect(()=>{
        if(wasmcrypto) wasmcrypto.greet()
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