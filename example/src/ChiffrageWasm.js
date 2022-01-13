// https://koala42.com/using-webassembly-in-your-reactjs-app/
import { useEffect, useState } from 'react'

// Cipher JavaScript pour comparaison a WASM
const { XChaCha20 } = require('xchacha20-js');


const TAILLE_CHIFFRAGE = 1 * 1024 * 1024 + 5

function ChiffrageWasm(props) {
    
    const [wasmcrypto, setwasmcrypto] = useState()
    const [dureeChiffrage, setDureeChiffrage] = useState('')
    const [dureeChiffrageJs, setDureeChiffrageJs] = useState('')
    const [message, setMessage] = useState('')

    useEffect(()=>{
        loaddeps().then(deps=>{
            setwasmcrypto(deps.wasmcrypto)
        }).catch(err=>console.error("Erreur chargement wasmcrypto, %O", err))
    }, [])

    useEffect(()=>{
        if(wasmcrypto) {
            tests()
            console.debug("WASM Crypto charge")
            chiffrer(wasmcrypto, setDureeChiffrage, setDureeChiffrageJs, setMessage).catch(err=>console.error("Erreur wasmcrypto chiffrer: %O", err))
        }
    }, [wasmcrypto])

    return (
        <div>
            <h1>Chiffrage Wasm</h1>

            <p>Taille du contenu a chiffrer : {TAILLE_CHIFFRAGE}</p>

            <p>Duree WASM : {dureeChiffrage}</p>
            
            <p>Duree JS : {dureeChiffrageJs}</p>

            <p>{message}</p>

        </div>
    )
}

export default ChiffrageWasm

function combinerBuffers(buffer1, buffer2) {
    let buffersCombines = new Uint8Array(buffer1.length + buffer2.length)
    buffersCombines.set(buffer1, 0)
    buffersCombines.set(buffer2, buffer1.length)
    return buffersCombines
}

function tests() {
    let buffer1 = new Uint8Array(Buffer.from([1, 2, 3, 4, 5]))
    let buffer2 = new Uint8Array(Buffer.from([6, 7, 8, 9, 10, 11, 12]))

    console.debug("Buffers %O, %O", buffer1, buffer2)

    // let buffer3 = Buffer.from([buffer1, buffer2])
    let buffer3 = combinerBuffers(buffer1, buffer2)
    console.debug("Buffers combines %O", buffer3)
}

async function loaddeps() {
    const wasmcrypto = await import('@dugrema/wasm-crypto/wasm_crypto.js')
    return {wasmcrypto}
}

async function chiffrer(wasmcrypto, setDureeChiffrage, setDureeChiffrageJs, setMessage) {

    await setMessage("Debut chiffrage")

    await chiffrerWasm(wasmcrypto, setDureeChiffrage, setMessage)
    await chiffrerJs(setMessage, setDureeChiffrageJs)
    await chiffrerWasm(wasmcrypto, setDureeChiffrage, setMessage)

    await setMessage("Chiffrage termine")
}

async function chiffrerWasm(wasmcrypto, setDureeChiffrage, setMessage) {
    await setMessage("Chiffrage WASM")

    const nonce = new Uint8Array(19)
    await window.crypto.getRandomValues(nonce)
    var key = new Uint8Array(32)
    await window.crypto.getRandomValues(key)

    const messageString = "Je veux chiffrer un message avec WASM puis faire la difference entre WASM et pur JavaScript."
    const encoder = new TextEncoder()
    // let messageBytes = encoder.encode(messageString)
    // console.debug("Chiffrer : %O", messageBytes)
    let messageBytes = new Uint8Array(TAILLE_CHIFFRAGE)

    // const valeurs = [
    //     {done: false, value: Buffer.from([0, 1, 2, 3, 4])},
    //     {done: false, value: Buffer.from([5, 6, 7, 8])},
    //     {done: true, value: null},
    // ]

    const CHUNK_SIZE = 64 * 1024

    const readstream = {
        read: async () => {
            if(!messageBytes) {
                return {done: true, value: null}
            }
            let value = Buffer.from(messageBytes.slice(0, CHUNK_SIZE))
            if(value.length === CHUNK_SIZE) {
                messageBytes = messageBytes.slice(CHUNK_SIZE)
            } else {
                messageBytes = null
            }
            return {done: false, value}
        }
    }

    let outputData = new Uint8Array(0)

    const output = {
        write: async chunk => {
            console.debug("Recu chunk chiffre (output deja %s): %O", outputData.length, chunk)
            // await new Promise(resolve=>setTimeout(resolve, 250))
            outputData = combinerBuffers(outputData, chunk)
            console.debug("Output concat len %s", outputData.length)
            return true
        }
    }

    console.debug("Debut chiffrage")
    const debut = new Date()
    await wasmcrypto.xchacha20poly1305_chiffrer_stream(nonce, key, readstream, output)
    const finChiffrage = new Date()
    const duree = finChiffrage.getTime() - debut.getTime()
    await setDureeChiffrage('Chiffrage : '+duree+' ms, Dechiffrage: NA')
    console.debug("Done chiffrage - duree %s ms", duree)

    const readstreamChiffre = {
        read: async () => {
            if(!outputData || outputData.length === 0) {
                return {done: true, value: null}
            }
            let readLen = Math.min(outputData.length, CHUNK_SIZE)
            let value = Buffer.from(outputData.slice(0, readLen))
            // console.debug("Read len %s", value.length)
            if(value.length === CHUNK_SIZE) {
                outputData = outputData.slice(CHUNK_SIZE)
            } else {
                outputData = null
            }
            // console.debug("!!! Output data chiffre restant : %s", outputData?outputData.length:'null')
            return {done: false, value}
        }
    }

    let outputDechiffrage = []
    const outputDechiffrageStream = {
        write: async chunk => {
            // console.debug("Recu chunk dechiffre : %O", chunk)
            // await new Promise(resolve=>setTimeout(resolve, 250))
            outputDechiffrage = combinerBuffers(outputDechiffrage, chunk)
            return true
        }
    }

    console.debug("Taill Contenu chiffre : %d", outputDechiffrage.length)

    const debutDechiffrage = new Date()
    await wasmcrypto.xchacha20poly1305_dechiffrer_stream(nonce, key, readstreamChiffre, outputDechiffrageStream)
    const finDechiffrage = new Date()
    const dureeDechiffrage = finDechiffrage.getTime() - debutDechiffrage.getTime()
    await setDureeChiffrage('Chiffrage : '+duree+' ms, Dechiffrage: ' + dureeDechiffrage + ' ms')
    console.debug("Done dechiffrage - duree %s ms", dureeDechiffrage)

}

async function chiffrerJs(setMessage, setDureeChiffrageJs) {
    await setMessage("Chiffrage JS")
    let messageBytes = new Uint8Array(TAILLE_CHIFFRAGE)

    console.debug("XChaCha20 : %O", XChaCha20)

    let xcha20 = new XChaCha20()
    // let message = "test message";
    let key = Buffer.from('808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f', 'hex');
    let nonce = Buffer.from('404142434445464748494a4b4c4d4e4f5051525354555658', 'hex');

    const debut = new Date()
     
    let blockCounter = 1; // Optional, defaults to 1 per the RFC
    const ciphertext = await xcha20.encrypt(messageBytes, nonce, key, blockCounter)
    //.then(
        // function (ciphertext) {
        //     xcha20.decrypt(ciphertext, nonce, key, blockCounter).then(
        //         function (plaintext) {
        //             console.log(plaintext.toString() === message); // true
        //         }
        //     )
        // }
    //);
    const fin = new Date()
    const duree = fin.getTime() - debut.getTime()
    setDureeChiffrageJs(''+duree+' ms')

}
