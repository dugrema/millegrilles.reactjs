import { wrap } from 'comlink'

import ChiffrageWorker from './chiffrage.worker'
import ConnexionWorker from './connexion.worker'
import X509Worker from './x509.worker'

// Exemple de loader pour web workers
export default function chargerWorkers() {
    const {worker: chiffrage} = charger(ChiffrageWorker)
    const {worker: connexion} = charger(ConnexionWorker)
    const {worker: x509} = charger(X509Worker)
    return {chiffrage, connexion, x509}
}

function charger(ClasseWorker) {
    const instance = new ClasseWorker()
    const worker = wrap(instance)
    return {instance, worker}
}