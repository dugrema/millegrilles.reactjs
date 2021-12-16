import React, { useCallback } from 'react'
import { FilePicker } from '@dugrema/millegrilles.reactjs'

export default props => {

    const actionPath = useCallback( cuuidpath => {
        console.debug("Set path : %O", cuuidpath)
    }, [])

    return (
        <div>
            <h1>File picker example</h1>
            <div style={{position: 'absolute', left: '1rem', width: '30rem', height: '40rem', border: '1px solid black'}}>
                <FilePicker 
                    loadCollection={getContenu}
                    setPath={actionPath}
                />
            </div>
        </div>
    )
}

async function getContenu(cuuid) {
    if(!cuuid) {
        return [
            {nom: 'A', tuuid: 'abcd-1'},
            {nom: 'B', tuuid: 'abcd-2'},
            {nom: 'C', tuuid: 'abcd-3'},
        ]
    } else if(cuuid === 'abcd-1') {
        return [
            {nom: 'F1', tuuid: 'abcd-1-1'},
            {nom: 'F2', tuuid: 'abcd-1-2'},
            {nom: 'F3', tuuid: 'abcd-1-3'},
        ]
    } else if(cuuid === 'abcd-3') {
        return [
            {nom: 'D1', tuuid: 'abcd-3-1'},
            {nom: 'D2', tuuid: 'abcd-3-2'},
            {nom: 'D3', tuuid: 'abcd-3-3'},
        ]
    } else if(cuuid === 'abcd-3-3') {
        return [
            {nom: 'E1', tuuid: 'abcd-3-3-1'},
            {nom: 'E2', tuuid: 'abcd-3-3-2'},
        ]
    }

}
