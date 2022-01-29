/* Facade pour crypto de nodejs. */
import { setCiphers } from '@dugrema/millegrilles.utiljs/src/chiffrage.ciphers'
import { hacher, Hacheur } from '@dugrema/millegrilles.utiljs/src/hachage'
import { base64 } from 'multiformats/bases/base64'

// S'assurer de charger les methodes de hachage
import ('./hachage')

// La librarie WASM doit etre chargee de maniere async
var _wasmcrypto = null

async function importWasmCrypto() {
    if(!_wasmcrypto) {
        _wasmcrypto = import('@dugrema/wasm-xchacha20poly1305/wasm_xchacha20poly1305.js')
            .then(wasmcrypto=>{
                _wasmcrypto = wasmcrypto
                return _wasmcrypto
            })
    }
    return _wasmcrypto
}

async function creerCipherChacha20Poly1305(key, nonce, opts) {
    opts = opts || {}
    const digestAlgo = opts.digestAlgo || 'blake2b-512'

    // Preparer input et output streams
    const wasmcrypto = await importWasmCrypto()
    const {controller: controllerInput, stream: streamInput} = await creerReadableStream()
    const {controller: controllerOutput, stream: streamOutput} = await creerReadableStream()
    const readerInput = await streamInput.getReader()
    const readerOutput = await streamOutput.getReader()

    // Creer interface du readerInput pour faire feed en Uint8Array
    const readerInterface = {
        read: async () => {
            const input = await readerInput.read()
            if(input.done) return input
            const value = [...input.value]
            return {done: false, value}
        }
    }

    const output = {
        write: async chunk => {
            // console.debug("Recu chunk chiffre %O", chunk)
            controllerOutput.enqueue(chunk)
            return true
        },
        close: async () => {
            controllerOutput.close()
            // console.debug("Output closed")
            return true
        }
    }
    
    // console.debug("Controller: %O\nstream: %O\nreader: %O", controllerInput, streamInput, readerInput)

    // Preparer cipher (WASM)
    const asyncCipher = wasmcrypto.chacha20poly1305_encrypt_stream(nonce, key, readerInterface, output)

    // Preparer hachage (WASM)
    const hacheur = new Hacheur({hashingCode: digestAlgo})
    await hacheur.ready
    let tag = null, hachage = null, taille = 0
    let _done = false

    return {
        update: async data => {
            controllerInput.enqueue(data)
            // console.debug("Data enqueue : %O", data)

            // Lire une "chunk" en output pour simuler sync
            let {done, value: ciphertext} = await readerOutput.read()
            if(!done) {
                ciphertext = new Uint8Array(ciphertext)
                // console.debug("ciphertext output lu : %O", ciphertext)
                await hacheur.update(ciphertext)
                taille += data.length
            } else {
                _done = true
            }

            return ciphertext
        },
        finalize: async () => {
            // console.debug("Finalize")
            controllerInput.close()

            let ciphertext = null
            if(!_done) {
                ciphertext = []
                let output = await readerOutput.read()
                while(!output.done) {
                    ciphertext = [...ciphertext, ...output.value]
                    output = await readerOutput.read()
                }
            }
            if(ciphertext.length === 0) ciphertext = null
            else {
                ciphertext = new Uint8Array(ciphertext)
                await hacheur.update(ciphertext)
            }

            hachage = await hacheur.finalize()
            tag = await asyncCipher
            // console.debug("Tag : %O", tag)
            tag = base64.encode(new Uint8Array(tag))

            return {tag, hachage, taille, ciphertext}
        },
        tag: () => tag,
        hachage: () => hachage,
    }
}

async function creerDecipherChacha20Poly1305(key, nonce, opts) {
    opts = opts || {}

    let tag = opts.tag
    if(!tag) throw new Error("Il faut fournir opts.tag pour cet algorithme")
    if(typeof(tag) === 'string') tag = base64.decode(tag)

    const wasmcrypto = await importWasmCrypto()

    // Preparer input et output streams
    const {controller: controllerInput, stream: streamInput} = await creerReadableStream()
    const {controller: controllerOutput, stream: streamOutput} = await creerReadableStream()
    const readerInput = await streamInput.getReader()
    const readerOutput = await streamOutput.getReader()

    // Creer interface du readerInput pour faire feed en Uint8Array
    const readerInterface = {
        read: async () => {
            const input = await readerInput.read()
            if(input.done) return input
            // Convert input to array
            const value = [...input.value]
            return {done: false, value}
        }
    }

    const output = {
        write: async chunk => {
            // console.debug("Recu chunk chiffre %O", chunk)
            controllerOutput.enqueue(chunk)
            return true
        },
        close: async () => {
            controllerOutput.close()
            // console.debug("Output closed")
            return true
        }
    }

    // Preparer cipher (WASM)
    const asyncDecipher = wasmcrypto.chacha20poly1305_decrypt_stream(nonce, key, tag, readerInterface, output)

    let _done = false

    return {
        update: async data => {
            controllerInput.enqueue(data)
            // console.debug("Data enqueue : %O", data)

            // Lire une "chunk" en output pour simuler sync
            let {done, value: message} = await readerOutput.read()
            if(!done) {
                message = new Uint8Array(message)
                // console.debug("ciphertext output lu : %O", ciphertext)
            } else {
                _done = true
            }

            return message
        },
        finalize: async () => {
            // console.debug("Finalize")
            controllerInput.close()

            let message = null
            if(!_done) {
                message = []
                let output = await readerOutput.read()
                while(!output.done) {
                    message = [...message, ...output.value]
                    output = await readerOutput.read()
                }
            }
            if(message.length === 0) message = null
            else {
                message = new Uint8Array(message)
            }

            await asyncDecipher  // Attendre la verification du tag
            
            return message
        },
    }

}

/**
 * One pass encrypt ChaCha20Poly1305.
 * @param {*} key 
 * @param {*} nonce 
 * @param {*} data 
 * @param {*} opts 
 */
async function encryptChacha20Poly1305(key, nonce, data, opts) {
    const wasmcrypto = await importWasmCrypto()
    const ciphertextTag = await wasmcrypto.chacha20poly1305_encrypt(nonce, key, data)
    const ciphertext = Buffer.from(ciphertextTag.slice(0, ciphertextTag.length-16))
    const tag = Buffer.from(ciphertextTag.slice(ciphertextTag.length-16))

    // Hacher contenu chiffre
    const hachage = await hacher(ciphertext, opts)

    return {ciphertext, tag, hachage}
}

/**
 * One pass decrypt ChaCha20Poly1305.
 * @param {*} key 
 * @param {*} nonce 
 * @param {*} data 
 * @param {*} tag 
 * @param {*} opts 
 */
async function decryptChacha20Poly1305(key, nonce, data, tag, opts) {
    const wasmcrypto = await importWasmCrypto()
    if(typeof(tag)==='string') tag = base64.decode(tag)
    if(typeof(nonce)==='string') nonce = base64.decode(nonce)

    if(ArrayBuffer.isView(tag)) tag = Buffer.from(tag)
    if(ArrayBuffer.isView(data)) data = Buffer.from(data)
    if(ArrayBuffer.isView(nonce)) nonce = Buffer.from(nonce)

    // console.debug("Data: %O, tag: %O", data, tag)
    const ciphertextTag = new Uint8Array(Buffer.concat([data, tag]))
    const messageDechiffre = await wasmcrypto.chacha20poly1305_decrypt(nonce, key, ciphertextTag)

    return messageDechiffre
}

async function creerReadableStream() {

    let readableStream = null
    const controller = await new Promise(resolve => {
        readableStream = new ReadableStream({
            start: controller => {
                resolve(controller)
            },
        })
    })

    return {controller, stream: readableStream}
}

const ciphers = {
    // Nodejs Crypto
    'chacha20-poly1305': {
        encrypt: encryptChacha20Poly1305,
        decrypt: decryptChacha20Poly1305,
        getCipher: creerCipherChacha20Poly1305,
        getDecipher: creerDecipherChacha20Poly1305,
        nonceSize: 12,
    }
}

setCiphers(ciphers)
