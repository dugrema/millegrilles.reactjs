import { wrap } from 'comlink'

import ChiffrageWorker from './chiffrage.worker'
import ConnexionWorker from './connexion.worker'
// import X509Worker from './x509.worker'
import TransfertWorker from './transfert.worker'

// Exemple de loader pour web workers
export default function chargerWorkers() {
    const {worker: chiffrage} = charger(ChiffrageWorker)
    const {worker: connexion} = charger(ConnexionWorker)
    // const {worker: x509} = charger(X509Worker)
    const {worker: transfertFichiers} = charger(TransfertWorker)
    return {chiffrage, connexion, x509: chiffrage, transfertFichiers}
}

function charger(ClasseWorker) {
    const instance = new ClasseWorker()
    const worker = wrap(instance)
    return {instance, worker}
}