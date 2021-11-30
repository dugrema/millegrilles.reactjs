import React, {useEffect} from 'react'
import ConnexionWorker from './connexion.worker'
import { wrap } from 'comlink'

export default function SocketIoExemple(props) {

    useEffect(()=>{
        const instance = new ConnexionWorker()
        console.debug("Instance worker : %O", instance)
        const worker = wrap(instance);
        worker.getInformationMillegrille().then(info=>{
            console.debug("Connexion info : %O", info)
        }).catch(err=>{console.error("Erreur info connexion : %O", err)})
    }, [])

    return (
        <h1>Socket.IO Connexion Client worker exemple</h1>
    )
}
