import { useEffect, useState } from 'react'
//import { genererClePrivee, chargerPemClePriveeEd25519 } from '@dugrema/millegrilles.utiljs/dist/index.min.js'

//import { pki, ed25519 } from '@dugrema/node-forge'

// console.debug("Forge : %O", Object.keys(forge))

function ChiffrageEd25519(props) {

    const [pem, setPem] = useState()

    useEffect(()=>{
        run(setPem).catch(err=>console.error("Erreur run cle : %O", err))
    }, [])

    return (
        <div>
            <h1>Chiffrage Ed25519</h1>
            
            <p>PEM Prive</p>
            <textarea cols="64" rows="20" value={pem}/>
            
        </div>
    )

}

export default ChiffrageEd25519

const password = 'myCustomPasswordHere'

async function run(setPem) {
    // const keypair = ed25519.generateKeyPair();
    // console.debug("Nouveau keypair ED25519 : %O", keypair)
    // const pemChiffre = cleToPem(keypair.privateKey, setPem)
    // pemToCle(pemChiffre)

    // const cles = genererClePrivee({password})
    // console.debug("Cles : %O", cles)
    // console.debug("PEM CHIFFRE\n%s", cles.pemChiffre)
    // setPem(cles.pemChiffre)

    // const clePrivee = chargerPemClePriveeEd25519(cles.pemChiffre, {password})
    // console.debug("Cle privee dechiffree : %O", clePrivee)
}

// function cleToPem(cle, setPem) {
//     const clePem = ed25519.privateKeyToPem(cle)
//     console.debug("PEM Prive\n%s", clePem)

//     const asn1Key = ed25519.privateKeyToAsn1(cle)
//     console.debug("ASN1 Key: %O", asn1Key)
//     var encryptedPrivateKeyInfo = pki.encryptPrivateKeyInfo(
//         asn1Key, 
//         password, 
//         { algorithm: 'aes256' }
//     )
//     console.debug("Encrypted private key : %O", encryptedPrivateKeyInfo)
//     var pem = pki.encryptedPrivateKeyToPem(encryptedPrivateKeyInfo);
//     console.debug("PEM CHIFFRE:\n%s", pem)

//     const clesPem = clePem + '\n\n' + pem
//     setPem(clesPem)

//     return pem
// }

// function pemToCle(pem) {
//     const cleWrappee = pki.encryptedPrivateKeyFromPem(pem)
//     console.debug("Lecture pem chiffre, cleWrappee: %O", cleWrappee)

//     const cleAsn1 = pki.decryptPrivateKeyInfo(cleWrappee, password)
//     console.debug("Cle privee dechiffree : %O", cleAsn1)
    
//     const clePrivee = ed25519.privateKeyFromAsn1(cleAsn1)
//     console.debug("Cle privee : %O", clePrivee)
// }
