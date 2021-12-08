import React from 'react'
import ReactPlayer from 'react-player/file'

export default props => {
    const {
        src, 
        // poster,
    } = props

    return (
        <ReactPlayer 
            url={src} 
            width={'100%'} 
            height={'100%'} 
            controls={true} 
            />
    )

}
