import React from 'react'
import ReactPlayer from 'react-player/file'

function VideoViewer(props) {
    const {
        src, 
        // poster,
        className,
    } = props

    const width = props.width || '100%',
          height = props.height || '100%'

    return (
        <ReactPlayer 
            className={className}
            url={src} 
            width={width} 
            height={height} 
            controls={true} 
            />
    )
}

export default VideoViewer
