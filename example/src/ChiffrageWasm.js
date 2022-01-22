// https://koala42.com/using-webassembly-in-your-reactjs-app/
import { useEffect, useState } from 'react'

// Cipher JavaScript pour comparaison a WASM
const { XChaCha20 } = require('xchacha20-js');
const Poly1305 = require('poly1305-js');


const TAILLE_CHIFFRAGE = 32  // 1 * 1024 * 1024 + 5

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
    const wasmcrypto = await import('@dugrema/wasm-xchacha20poly1305/wasm_chacha20poly1305.js')
    return {wasmcrypto}
}

async function chiffrer(wasmcrypto, setDureeChiffrage, setDureeChiffrageJs, setMessage) {

    await setMessage("Debut chiffrage")

    await chiffrerWasm(wasmcrypto, setDureeChiffrage, setMessage)
    await chiffrerJs(wasmcrypto, setMessage, setDureeChiffrageJs)

    await setMessage("Chiffrage termine")
}

async function chiffrerWasm(wasmcrypto, setDureeChiffrage, setMessage) {
    await setMessage("Chiffrage WASM")

    // const nonce = new Uint8Array(19)
    // await window.crypto.getRandomValues(nonce)
    // var key = new Uint8Array(32)
    // await window.crypto.getRandomValues(key)

    const key = Buffer.from('808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f', 'hex');
    // const nonce = Buffer.from('404142434445464748494a4b4c4d4e4f505152', 'hex');
    const nonce = Buffer.from('404142434445464748494a4b', 'hex');

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
    const tag = await wasmcrypto.chacha20poly1305_encrypt_stream(nonce, key, readstream, output)
    console.debug("Tag recu : %O", tag)
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
            console.debug("Recu chunk dechiffre : %O", chunk)
            // await new Promise(resolve=>setTimeout(resolve, 250))
            outputDechiffrage = combinerBuffers(outputDechiffrage, chunk)
            return true
        }
    }

    console.debug("Taill Contenu chiffre : %d", outputDechiffrage.length)

    const debutDechiffrage = new Date()
    await wasmcrypto.chacha20poly1305_decrypt_stream(nonce, key, tag, readstreamChiffre, outputDechiffrageStream)
    const finDechiffrage = new Date()
    const dureeDechiffrage = finDechiffrage.getTime() - debutDechiffrage.getTime()
    await setDureeChiffrage('Chiffrage : '+duree+' ms, Dechiffrage: ' + dureeDechiffrage + ' ms')
    console.debug("Done dechiffrage - duree %s ms", dureeDechiffrage)
    console.debug("Contenu dechiffre : %O", outputDechiffrage)

}

async function chiffrerJs(wasmcrypto, setMessage, setDureeChiffrageJs) {
    await setMessage("Chiffrage JS")

    let messageBytes = new Uint8Array(TAILLE_CHIFFRAGE)

    console.debug("XChaCha20 : %O", XChaCha20)

    let xcha20 = new XChaCha20()
    // let message = "test message";
    let key = Buffer.from('808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f', 'hex');
    let nonce = Buffer.from('404142434445464748494a4b4c4d4e4f5051525354555658', 'hex');

    const debut = new Date()
     
    let blockCounter = 1; // Optional, defaults to 1 per the RFC
    let ciphertext = await xcha20.encrypt(messageBytes, nonce, key, blockCounter)
    // let tag = await Poly1305.onetimeauth(ciphertext, key);
    // let cipherauth = new Uint8Array(ciphertext.length + tag.length)
    // cipherauth.set(ciphertext, 0)
    // cipherauth.set(tag, ciphertext.length)
    const fin = new Date()
    const duree = fin.getTime() - debut.getTime()
    setDureeChiffrageJs(''+duree+' ms')

}

async function chiffrageComparaison(wasmcrypto, setMessage) {

}

const MESSAGE_1 = 'un message secret',
      KEY_1 = 'm7o6Oy11rqROwiWk/UgE1zq+UifXeMYdwecDhDZkjENo',
      NONCE_1 = 'mwbQUFbYMUR1f3eu5',
      CYPHERTEXT_1 = 'mTkvJw79bU02T7aVAMa2APm8xUs5Ao/9YX+n1gEqbXwfa'
