import React, {useEffect} from 'react'
import loader from './workerLoader.js'
import { proxy } from 'comlink'

export default function WorkersExemple(props) {

    useEffect(()=>{
        charger()
    }, [])

    return (
        <h1>Workers exemple</h1>
    )
}

async function charger() {
    const workers = loader()
    const {connexion, chiffrage, x509} = workers

    // try {
    //     await chiffrage.initialiserFormatteurMessage()
    //     console.debug("Ok!")
    // } catch(err) {
    //     console.error("Erreur initialiserFormatteurMessage : %O", err)
    // }

    // try {
    //     await x509.init(CA_PEM)
    //     console.debug("X509 chargement OK")
    // } catch(err) {
    //     console.error("Erreur x509 : %O", err)
    // }

    try {
        await connecter(connexion, workers)
    } catch(err) {
        console.error("Erreur info connexion : %O", err)
    }

}

async function connecter(connexion, workers) {
    // const info = await connexion.getInformationMillegrille()
    const location = new URL(window.location.href)
    location.pathname = 'grosfichiers'  // Pour test
    console.debug("Connecter a %O", location)

    // Preparer callbacks
    const setUsagerCb = proxy( usager => setUsager(workers, usager) )
    await connexion.setCallbacks(proxy(setEtatConnexion), workers.x509, setUsagerCb)

    const info = await connexion.connecter(location.href)
    console.debug("Connexion info : %O", info)
}

function setEtatConnexion(etat) {
    console.debug("Etat connexion : %O", etat)
}

async function setUsager(workers, nomUsager) {
    console.debug("Usager : '%s'", nomUsager)
    const {getUsager} = await import('@dugrema/millegrilles.reactjs')
    const usager = await getUsager(nomUsager)
    
    if(usager && usager.certificat) {
        const { connexion, chiffrage, x509 } = workers
        const fullchain = usager.certificat
        const caPem = [...fullchain].pop()

        const certificatPem = fullchain.join('')

        // Initialiser le CertificateStore
        await chiffrage.initialiserCertificateStore(caPem, {isPEM: true, DEBUG: false})
        await x509.init(caPem)
        await chiffrage.initialiserFormatteurMessage(certificatPem, usager.signer, usager.dechiffrer, {DEBUG: false})
        await connexion.initialiserFormatteurMessage(certificatPem, usager.signer, {DEBUG: false})
    
    } else {
        console.warn("Pas de certificat pour l'usager '%s'", usager)
    }
  
}

const CA_PEM = `
-----BEGIN CERTIFICATE-----
MIIEBjCCAm6gAwIBAgIKCSg3VilRiEQQADANBgkqhkiG9w0BAQ0FADAWMRQwEgYD
VQQDEwtNaWxsZUdyaWxsZTAeFw0yMTAyMjgyMzM4NDRaFw00MTAyMjgyMzM4NDRa
MBYxFDASBgNVBAMTC01pbGxlR3JpbGxlMIIBojANBgkqhkiG9w0BAQEFAAOCAY8A
MIIBigKCAYEAo7LsB6GKr+aKqzmF7jxa3GDzu7PPeOBtUL/5Q6OlZMfMKLdqTGd6
pg12GT2esBh2KWUTt6MwOz3NDgA2Yk+WU9huqmtsz2n7vqIgookhhLaQt/OoPeau
bJyhm3BSd+Fpf56H1Ya/qZl1Bow/h8r8SjImm8ol1sG9j+bTnaA5xWF4X2Jj7k2q
TYrJJYLTU+tEnL9jH2quaHyiuEnSOfMmSLeiaC+nyY/MuX2Qdr3LkTTTrF+uOji+
jTBFdZKxK1qGKSJ517jz9/gkDCe7tDnlTOS4qxQlIGPqVP6hcBPaeXjiQ6h1KTl2
1B5THx0yh0G9ixg90XUuDTHXgIw3vX5876ShxNXZ2ahdxbg38m4QlFMag1RfHh9Z
XPEPUOjEnAEUp10JgQcd70gXDet27BF5l9rXygxsNz6dqlP7oo2yI8XvdtMcFiYM
eFM1FF+KadV49cXTePqKMpir0mBtGLwtaPNAUZNGCcZCuxF/mt9XOYoBTUEIv1cq
LsLVaM53fUFFAgMBAAGjVjBUMBIGA1UdEwEB/wQIMAYBAf8CAQUwHQYDVR0OBBYE
FBqxQIPQn5vAHZiTyiUka+vTnuTuMB8GA1UdIwQYMBaAFBqxQIPQn5vAHZiTyiUk
a+vTnuTuMA0GCSqGSIb3DQEBDQUAA4IBgQBLjk2y9nDW2MlP+AYSZlArX9XewMCh
2xAjU63+nBG/1nFe5u3YdciLsJyiFBlOY2O+ZGliBcQ6EhFx7SoPRDB7v7YKv8+O
EYZOSyule+SlSk2Dv89eYdmgqess/3YyuJN8XDyEbIbP7UD2KtklxhwkpiWcVSC3
NK3ALaXwB/5dniuhxhgcoDhztvR7JiCD3fi1Gwi8zUR4BiZOgDQbn2O3NlgFNjDk
6eRNicWDJ19XjNRxuCKn4/8GlEdLPwlf4CoqKb+O31Bll4aWkWRb9U5lpk/Ia0Kr
o/PtNHZNEcxOrpmmiCIN1n5+Fpk5dIEKqSepWWLGpe1Omg2KPSBjFPGvciluoqfG
erI92ipS7xJLW1dkpwRGM2H42yD/RLLocPh5ZuW369snbw+axbcvHdST4LGU0Cda
yGZTCkka1NZqVTise4N+AV//BQjPsxdXyabarqD9ycrd5EFGOQQAFadIdQy+qZvJ
qn8fGEjvtcCyXhnbCjCO8gykHrRTXO2icrQ=
-----END CERTIFICATE-----
`
