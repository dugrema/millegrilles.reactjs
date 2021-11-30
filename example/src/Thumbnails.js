import React from 'react'

import { Thumbnail, ThumbnailHeader, ThumbnailFooter } from '@dugrema/millegrilles.reactjs'

export default function Thumbnails(props) {
    return (
        <>
            {['001_200.jpg', '001_128.jpg', '002_200.jpg', '004_200.jpg'].map(item=>{
                return (
                    <Thumbnail key={item}
                        src={"/res/" + item}
                        onClick={event=>testCall(event, item)}
                        onDoubleClick={event=>testCall2(event, item)}
                        onContextMenu={event=>{testContext(event, item)}}
                        >
                        <ThumbnailFooter>{item}</ThumbnailFooter>
                    </Thumbnail>
                )
            })}
            <Thumbnail
                onClick={event=>testCall(event, '001_200.jpg load')}
                onDoubleClick={event=>testCall2(event, '001_200.jpg load')}
                onContextMenu={event=>{testContext(event, '001_200.jpg load')}}
                loader={loadImage()}
                >
                <ThumbnailHeader>0:21</ThumbnailHeader>
                <ThumbnailFooter>001_200.jpg load</ThumbnailFooter>
            </Thumbnail>
        </>
    )
}

function testCall(event, value) {
    console.debug("call %s", value)
}

function testCall2(event, value) {
    console.debug("call 2, %s", value)
}

function testContext(event, value) {
    event.preventDefault()
    console.debug("context %s, position %d/%d", value, event.clientX, event.clientY)
}

function loadImage() {
    return {
        load: async setSrc => {
            setSrc('/res/001_128.jpg')
            await new Promise(resolve=>{setTimeout(resolve, 2000)})
            setSrc('/res/002_200.jpg')
        },
        unload: () => console.debug("Unload")
    }
}