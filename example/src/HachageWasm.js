import 'hash-wasm/dist/blake2b.umd.min.js'
import 'hash-wasm/dist/blake2s.umd.min.js'

import { useEffect, useState } from 'react'
// import { sha512, blake2b, blake2s } from 'hash-wasm'
import { createSHA512, createBLAKE2b } from 'hash-wasm'
import reactjs from '@dugrema/millegrilles.reactjs'
import { hacher, verifierHachage, encoderIdmg, verifierIdmg } from '@dugrema/millegrilles.utiljs'

function HachageWasm(props) {

    const [val, setVal] = useState('')

    useEffect(()=>{
        // runHachage(setVal).catch(err=>console.error("Erreur %O", err))
        // hacherUtiljs(setVal).catch(err=>console.error("Erreur %O", err))
        hacherCertificat(setVal).catch(err=>console.error("Erreur %O", err))
    }, [])

    return (
        <div>
            <p>Hachage Wasm</p>
            <pre>{val}</pre>
        </div>
    )
}

export default HachageWasm

async function runHachage(setVal) {
    const int32Buffer = new Uint32Array([1056, 641]);

    const hacheurBlake2s = await createBLAKE2b()
    await hacheurBlake2s.update(int32Buffer)
    const hachageBlake2s = await hacheurBlake2s.digest('binary')
    console.debug("Output hachageBlake2s %O", hachageBlake2s)

    const hacheurBlake2b = await createBLAKE2b()
    await hacheurBlake2b.update(int32Buffer)
    const hachageBlake2b = await hacheurBlake2b.digest('binary')
    console.debug("Output hachageBlake2b %O", hachageBlake2b)

    const hacheurSha512 = await createSHA512()
    await hacheurSha512.update(int32Buffer)
    const hachageSha512 = await hacheurSha512.digest('binary')
    console.debug("Output hachageSha512 %O", hachageSha512)

    // const hachageSha512 = await sha512(int32Buffer, 256, 'binary')
    // const hachageBlake2b = await blake2b(int32Buffer, 512, 'binary')
    // const hachageBlake2s = await blake2s(int32Buffer, 256, 'binary')
    
    const texte = `
        SHA2-512: ${hachageSha512}
        BLAKE2b: ${hachageBlake2b}
        BLAKE2s: ${hachageBlake2s}
    `
    setVal(texte)
}

async function hacherUtiljs(setVal) {
    const int32Buffer = new Uint32Array([1056, 641]);
    const hachageBlake2s = await hacher(int32Buffer, {hashingCode: 'blake2s-256'})
    console.debug("BLAKE2s hachage : %s", hachageBlake2s)
    const verifBlake2s = await verifierHachage(hachageBlake2s, int32Buffer)
    console.debug("Verification Blake2s : %O", verifBlake2s)

    const hachageBlake2b = await hacher(int32Buffer, {hashingCode: 'blake2b-512'})
    console.debug("BLAKE2b hachage : %s", hachageBlake2b)
    const verifBlake2b = await verifierHachage(hachageBlake2b, int32Buffer)
    console.debug("Verification Blake2b : %O", verifBlake2b)

    const hachageSha512 = await hacher(int32Buffer, {hashingCode: 'sha2-512'})
    console.debug("SHA2-512 hachage : %s", hachageSha512)
    const verifSha512 = await verifierHachage(hachageSha512, int32Buffer)
    console.debug("Verification SHA2-512 : %O", verifSha512)

    const texte = `
        SHA2-512: ${hachageSha512} (verif ${verifBlake2s})
        BLAKE2b: ${hachageBlake2b} (verif ${verifBlake2b})
        BLAKE2s: ${hachageBlake2s} (verif ${verifSha512})
    `
    setVal(texte)

}

async function hacherCertificat() {
    const idmg = await encoderIdmg(CERT1)
    console.debug("IDMG calcule : %s", idmg)

    const idmgVerif = await verifierIdmg(idmg, CERT1)
    console.debug("Verif IDMG %s : %O", idmg, idmgVerif)
}

const CERT1 = `
-----BEGIN CERTIFICATE-----
MIIBUzCCAQWgAwIBAgIUbl3363S2J56H0agwMXf0a94C9RgwBQYDK2VwMBcxFTAT
BgNVBAMMDG1pbGxlZ3JpbGxlczAeFw0yMjAxMDkxMTM1NTVaFw00MjAxMDQxMTM1
NTVaMBcxFTATBgNVBAMMDG1pbGxlZ3JpbGxlczAqMAUGAytlcAMhAGQZ8QkmNIZQ
tqJS2Tcu0g7rIpprCOKz5gZUvzFVjsI4o2MwYTAPBgNVHRMBAf8EBTADAQH/MB0G
A1UdDgQWBBQJRu4NOqtYiAxQbbZNpgNQZ2vvczAfBgNVHSMEGDAWgBQJRu4NOqtY
iAxQbbZNpgNQZ2vvczAOBgNVHQ8BAf8EBAMCAaYwBQYDK2VwA0EA8yDLg6Mlx+L1
e/v99BfqbVQEqaNJpBCc9Eueoj45cFf1gVuM9h3FWFUb9TiP1+P0lQY4u+j8HnWE
72+IybWLBw==
-----END CERTIFICATE-----
`