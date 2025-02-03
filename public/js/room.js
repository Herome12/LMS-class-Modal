const socket = io();
const myvideo = document.querySelector("#vd1");
const roomid = params.get("room");
let username;
const chatRoom = document.querySelector('.chat-cont');
const sendButton = document.querySelector('.chat-send');
const messageField = document.querySelector('.chat-input');
const videoContainer = document.querySelector('#vcont');
const overlayContainer = document.querySelector('#overlay')
const continueButt = document.querySelector('.continue-name');
const nameField = document.querySelector('#name-field');
const videoButt = document.querySelector('.novideo');
const audioButt = document.querySelector('.audio');
const cutCall = document.querySelector('.cutcall');
const screenShareButt = document.querySelector('.screenshare');
const whiteboardButt = document.querySelector('.board-icon')

//whiteboard js start
const whiteboardCont = document.querySelector('.whiteboard-cont');
const canvas = document.querySelector("#whiteboard");
const ctx = canvas.getContext('2d');

let boardVisisble = false;

whiteboardCont.style.visibility = 'hidden';

let isDrawing = 0;
let x = 0;
let y = 0;
let color = "black";
let drawsize = 3;
let colorRemote = "black";
let drawsizeRemote = 3;

function fitToContainer(canvas) {
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
}

fitToContainer(canvas);

//getCanvas call is under join room call
socket.on('getCanvas', url => {
    let img = new Image();
    img.onload = start;
    img.src = url;

    function start() {
        ctx.drawImage(img, 0, 0);
    }

    console.log('got canvas', url)
})

function setColor(newcolor) {
    color = newcolor;
    drawsize = 3;
}

function setEraser() {
    color = "white";
    drawsize = 10;
}

//might remove this
function reportWindowSize() {
    fitToContainer(canvas);
}

window.onresize = reportWindowSize;
//

function clearBoard() {
    if (window.confirm('Are you sure you want to clear board? This cannot be undone')) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        socket.emit('store canvas', canvas.toDataURL());
        socket.emit('clearBoard');
    }
    else return;
}

socket.on('clearBoard', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
})

function draw(newx, newy, oldx, oldy) {
    ctx.strokeStyle = color;
    ctx.lineWidth = drawsize;
    ctx.beginPath();
    ctx.moveTo(oldx, oldy);
    ctx.lineTo(newx, newy);
    ctx.stroke();
    ctx.closePath();

    socket.emit('store canvas', canvas.toDataURL());

}

function drawRemote(newx, newy, oldx, oldy) {
    ctx.strokeStyle = colorRemote;
    ctx.lineWidth = drawsizeRemote;
    ctx.beginPath();
    ctx.moveTo(oldx, oldy);
    ctx.lineTo(newx, newy);
    ctx.stroke();
    ctx.closePath();

}

canvas.addEventListener('mousedown', e => {
    x = e.offsetX;
    y = e.offsetY;
    isDrawing = 1;
})

canvas.addEventListener('mousemove', e => {
    if (isDrawing) {
        draw(e.offsetX, e.offsetY, x, y);
        socket.emit('draw', e.offsetX, e.offsetY, x, y, color, drawsize);
        x = e.offsetX;
        y = e.offsetY;
    }
})

window.addEventListener('mouseup', e => {
    if (isDrawing) {
        isDrawing = 0;
    }
})

socket.on('draw', (newX, newY, prevX, prevY, color, size) => {
    colorRemote = color;
    drawsizeRemote = size;
    drawRemote(newX, newY, prevX, prevY);
})

//whiteboard js end

let videoAllowed = 1;
let audioAllowed = 1;

let micInfo = {};
let videoInfo = {};

let videoTrackReceived = {};

let mymuteicon = document.querySelector("#mymuteicon");
mymuteicon.style.visibility = 'hidden';

let myvideooff = document.querySelector("#myvideooff");
myvideooff.style.visibility = 'hidden';

const configuration = { iceServers: [{ urls: "stun:stun.stunprotocol.org" }] }

const mediaConstraints = { video: true, audio: true };

let connections = {};
let cName = {};
let audioTrackSent = {};
let videoTrackSent = {};

let mystream, myscreenshare;


document.querySelector('.roomcode').innerHTML = `${roomid}`

function CopyClassText() {

    var textToCopy = document.querySelector('.roomcode');
    var currentRange;
    if (document.getSelection().rangeCount > 0) {
        currentRange = document.getSelection().getRangeAt(0);
        window.getSelection().removeRange(currentRange);
    }
    else {
        currentRange = false;
    }

    var CopyRange = document.createRange();
    CopyRange.selectNode(textToCopy);
    window.getSelection().addRange(CopyRange);
    document.execCommand("copy");

    window.getSelection().removeRange(CopyRange);

    if (currentRange) {
        window.getSelection().addRange(currentRange);
    }

    document.querySelector(".copycode-button").textContent = "Copied!"
    setTimeout(()=>{
        document.querySelector(".copycode-button").textContent = "Copy Code";
    }, 5000);
}


continueButt.addEventListener('click', () => {
    if (nameField.value == '') return;
    username = nameField.value;
    overlayContainer.style.visibility = 'hidden';
    document.querySelector("#myname").innerHTML = `${username} (You)`;
    socket.emit("join room", roomid, username);

})

nameField.addEventListener("keyup", function (event) {
    if (event.keyCode === 13) {
        event.preventDefault();
        continueButt.click();
    }
});

socket.on('user count', count => {
    if (count > 1) {
        videoContainer.className = 'video-cont';
    }
    else {
        videoContainer.className = 'video-cont-single';
    }
})

let peerConnection;

function handleGetUserMediaError(e) {
    switch (e.name) {
        case "NotFoundError":
            alert("Unable to open your call because no camera and/or microphone" +
                "were found.");
            break;
        case "SecurityError":
        case "PermissionDeniedError":
            break;
        default:
            alert("Error opening your camera and/or microphone: " + e.message);
            break;
    }

}


function reportError(e) {
    console.log(e);
    return;
}


function startCall() {

    navigator.mediaDevices.getUserMedia(mediaConstraints)
        .then(localStream => {
            myvideo.srcObject = localStream;
            myvideo.muted = true;

            localStream.getTracks().forEach(track => {
                for (let key in connections) {
                    connections[key].addTrack(track, localStream);
                    if (track.kind === 'audio')
                        audioTrackSent[key] = track;
                    else
                        videoTrackSent[key] = track;
                }
            })

        })
        .catch(handleGetUserMediaError);


}

function handleVideoOffer(offer, sid, cname, micinf, vidinf) {

    cName[sid] = cname;
    console.log('video offered recevied');
    micInfo[sid] = micinf;
    videoInfo[sid] = vidinf;
    connections[sid] = new RTCPeerConnection(configuration);

    connections[sid].onicecandidate = function (event) {
        if (event.candidate) {
            console.log('icecandidate fired');
            socket.emit('new icecandidate', event.candidate, sid);
        }
    };

    connections[sid].ontrack = function (event) {

        if (!document.getElementById(sid)) {
            console.log('track event fired')
            let vidCont = document.createElement('div');
            let newvideo = document.createElement('video');
            let name = document.createElement('div');
            let muteIcon = document.createElement('div');
            let videoOff = document.createElement('div');
            videoOff.classList.add('video-off');
            muteIcon.classList.add('mute-icon');
            name.classList.add('nametag');
            name.innerHTML = `${cName[sid]}`;
            vidCont.id = sid;
            muteIcon.id = `mute${sid}`;
            videoOff.id = `vidoff${sid}`;
            muteIcon.innerHTML = `<i class="fas fa-microphone-slash"></i>`;
            videoOff.innerHTML = 'Video Off'
            vidCont.classList.add('video-box');
            newvideo.classList.add('video-frame');
            newvideo.autoplay = true;
            newvideo.playsinline = true;
            newvideo.id = `video${sid}`;
            newvideo.srcObject = event.streams[0];

            if (micInfo[sid] == 'on')
                muteIcon.style.visibility = 'hidden';
            else
                muteIcon.style.visibility = 'visible';

            if (videoInfo[sid] == 'on')
                videoOff.style.visibility = 'hidden';
            else
                videoOff.style.visibility = 'visible';

            vidCont.appendChild(newvideo);
            vidCont.appendChild(name);
            vidCont.appendChild(muteIcon);
            vidCont.appendChild(videoOff);

            videoContainer.appendChild(vidCont);

        }


    };

    connections[sid].onremovetrack = function (event) {
        if (document.getElementById(sid)) {
            document.getElementById(sid).remove();
            console.log('removed a track');
        }
    };

    connections[sid].onnegotiationneeded = function () {

        connections[sid].createOffer()
            .then(function (offer) {
                return connections[sid].setLocalDescription(offer);
            })
            .then(function () {

                socket.emit('video-offer', connections[sid].localDescription, sid);

            })
            .catch(reportError);
    };

    let desc = new RTCSessionDescription(offer);

    connections[sid].setRemoteDescription(desc)
        .then(() => { return navigator.mediaDevices.getUserMedia(mediaConstraints) })
        .then((localStream) => {

            localStream.getTracks().forEach(track => {
                connections[sid].addTrack(track, localStream);
                console.log('added local stream to peer')
                if (track.kind === 'audio') {
                    audioTrackSent[sid] = track;
                    if (!audioAllowed)
                        audioTrackSent[sid].enabled = false;
                }
                else {
                    videoTrackSent[sid] = track;
                    if (!videoAllowed)
                        videoTrackSent[sid].enabled = false
                }
            })

        })
        .then(() => {
            return connections[sid].createAnswer();
        })
        .then(answer => {
            return connections[sid].setLocalDescription(answer);
        })
        .then(() => {
            socket.emit('video-answer', connections[sid].localDescription, sid);
        })
        .catch(handleGetUserMediaError);


}

function handleNewIceCandidate(candidate, sid) {
    console.log('new candidate recieved')
    var newcandidate = new RTCIceCandidate(candidate);

    connections[sid].addIceCandidate(newcandidate)
        .catch(reportError);
}

function handleVideoAnswer(answer, sid) {
    console.log('answered the offer')
    const ans = new RTCSessionDescription(answer);
    connections[sid].setRemoteDescription(ans);
}

//Thanks to (https://github.com/miroslavpejic85) for ScreenShare Code

screenShareButt.addEventListener('click', () => {
    screenShareToggle();
});
let screenshareEnabled = false;
function screenShareToggle() {
    let screenMediaPromise;
    if (!screenshareEnabled) {
        if (navigator.getDisplayMedia) {
            screenMediaPromise = navigator.getDisplayMedia({ video: true });
        } else if (navigator.mediaDevices.getDisplayMedia) {
            screenMediaPromise = navigator.mediaDevices.getDisplayMedia({ video: true });
        } else {
            screenMediaPromise = navigator.mediaDevices.getUserMedia({
                video: { mediaSource: "screen" },
            });
        }
    } else {
        screenMediaPromise = navigator.mediaDevices.getUserMedia({ video: true });
    }
    screenMediaPromise
        .then((myscreenshare) => {
            screenshareEnabled = !screenshareEnabled;
            for (let key in connections) {
                const sender = connections[key]
                    .getSenders()
                    .find((s) => (s.track ? s.track.kind === "video" : false));
                sender.replaceTrack(myscreenshare.getVideoTracks()[0]);
            }
            myscreenshare.getVideoTracks()[0].enabled = true;
            const newStream = new MediaStream([
                myscreenshare.getVideoTracks()[0], 
            ]);
            myvideo.srcObject = newStream;
            myvideo.muted = true;
            mystream = newStream;
            screenShareButt.innerHTML = (screenshareEnabled 
                ? `<i class="fas fa-desktop"></i><span class="tooltiptext">Stop Share Screen</span>`
                : `<i class="fas fa-desktop"></i><span class="tooltiptext">Share Screen</span>`
            );
            myscreenshare.getVideoTracks()[0].onended = function() {
                if (screenshareEnabled) screenShareToggle();
            };
        })
        .catch((e) => {
            alert("Unable to share screen:" + e.message);
            console.error(e);
        });
}

socket.on('video-offer', handleVideoOffer);

socket.on('new icecandidate', handleNewIceCandidate);

socket.on('video-answer', handleVideoAnswer);


socket.on('join room', async (conc, cnames, micinfo, videoinfo) => {
    socket.emit('getCanvas');
    if (cnames)
        cName = cnames;

    if (micinfo)
        micInfo = micinfo;

    if (videoinfo)
        videoInfo = videoinfo;


    console.log(cName);
    if (conc) {
        await conc.forEach(sid => {
            connections[sid] = new RTCPeerConnection(configuration);

            connections[sid].onicecandidate = function (event) {
                if (event.candidate) {
                    console.log('icecandidate fired');
                    socket.emit('new icecandidate', event.candidate, sid);
                }
            };

            connections[sid].ontrack = function (event) {

                if (!document.getElementById(sid)) {
                    console.log('track event fired')
                    let vidCont = document.createElement('div');
                    let newvideo = document.createElement('video');
                    let name = document.createElement('div');
                    let muteIcon = document.createElement('div');
                    let videoOff = document.createElement('div');
                    videoOff.classList.add('video-off');
                    muteIcon.classList.add('mute-icon');
                    name.classList.add('nametag');
                    name.innerHTML = `${cName[sid]}`;
                    vidCont.id = sid;
                    muteIcon.id = `mute${sid}`;
                    videoOff.id = `vidoff${sid}`;
                    muteIcon.innerHTML = `<i class="fas fa-microphone-slash"></i>`;
                    videoOff.innerHTML = 'Video Off'
                    vidCont.classList.add('video-box');
                    newvideo.classList.add('video-frame');
                    newvideo.autoplay = true;
                    newvideo.playsinline = true;
                    newvideo.id = `video${sid}`;
                    newvideo.srcObject = event.streams[0];

                    if (micInfo[sid] == 'on')
                        muteIcon.style.visibility = 'hidden';
                    else
                        muteIcon.style.visibility = 'visible';

                    if (videoInfo[sid] == 'on')
                        videoOff.style.visibility = 'hidden';
                    else
                        videoOff.style.visibility = 'visible';

                    vidCont.appendChild(newvideo);
                    vidCont.appendChild(name);
                    vidCont.appendChild(muteIcon);
                    vidCont.appendChild(videoOff);

                    videoContainer.appendChild(vidCont);

                }

            };

            connections[sid].onremovetrack = function (event) {
                if (document.getElementById(sid)) {
                    document.getElementById(sid).remove();
                }
            }

            connections[sid].onnegotiationneeded = function () {

                connections[sid].createOffer()
                    .then(function (offer) {
                        return connections[sid].setLocalDescription(offer);
                    })
                    .then(function () {

                        socket.emit('video-offer', connections[sid].localDescription, sid);

                    })
                    .catch(reportError);
            };

        });

        console.log('added all sockets to connections');
        startCall();

    }
    else {
        console.log('waiting for someone to join');
        navigator.mediaDevices.getUserMedia(mediaConstraints)
            .then(localStream => {
                myvideo.srcObject = localStream;
                myvideo.muted = true;
                mystream = localStream;
            })
            .catch(handleGetUserMediaError);
    }
})

socket.on('remove peer', sid => {
    if (document.getElementById(sid)) {
        document.getElementById(sid).remove();
    }

    delete connections[sid];
})

sendButton.addEventListener('click', () => {
    const msg = messageField.value;
    messageField.value = '';
    socket.emit('message', msg, username, roomid);
})

messageField.addEventListener("keyup", function (event) {
    if (event.keyCode === 13) {
        event.preventDefault();
        sendButton.click();
    }
});

socket.on('message', (msg, sendername, time) => {
    chatRoom.scrollTop = chatRoom.scrollHeight;
    chatRoom.innerHTML += `<div class="message">
    <div class="info">
        <div class="username">${sendername}</div>
        <div class="time">${time}</div>
    </div>
    <div class="content">
        ${msg}
    </div>
</div>`
});

videoButt.addEventListener('click', () => {

    if (videoAllowed) {
        for (let key in videoTrackSent) {
            videoTrackSent[key].enabled = false;
        }
        videoButt.innerHTML = `<i class="fas fa-video-slash"></i>`;
        videoAllowed = 0;
        videoButt.style.backgroundColor = "#b12c2c";

        if (mystream) {
            mystream.getTracks().forEach(track => {
                if (track.kind === 'video') {
                    track.enabled = false;
                }
            })
        }

        myvideooff.style.visibility = 'visible';

        socket.emit('action', 'videooff');
    }
    else {
        for (let key in videoTrackSent) {
            videoTrackSent[key].enabled = true;
        }
        videoButt.innerHTML = `<i class="fas fa-video"></i>`;
        videoAllowed = 1;
        videoButt.style.backgroundColor = "#4ECCA3";
        if (mystream) {
            mystream.getTracks().forEach(track => {
                if (track.kind === 'video')
                    track.enabled = true;
            })
        }


        myvideooff.style.visibility = 'hidden';

        socket.emit('action', 'videoon');
    }
})


audioButt.addEventListener('click', () => {

    if (audioAllowed) {
        for (let key in audioTrackSent) {
            audioTrackSent[key].enabled = false;
        }
        audioButt.innerHTML = `<i class="fas fa-microphone-slash"></i>`;
        audioAllowed = 0;
        audioButt.style.backgroundColor = "#b12c2c";
        if (mystream) {
            mystream.getTracks().forEach(track => {
                if (track.kind === 'audio')
                    track.enabled = false;
            })
        }

        mymuteicon.style.visibility = 'visible';

        socket.emit('action', 'mute');
    }
    else {
        for (let key in audioTrackSent) {
            audioTrackSent[key].enabled = true;
        }
        audioButt.innerHTML = `<i class="fas fa-microphone"></i>`;
        audioAllowed = 1;
        audioButt.style.backgroundColor = "#4ECCA3";
        if (mystream) {
            mystream.getTracks().forEach(track => {
                if (track.kind === 'audio')
                    track.enabled = true;
            })
        }

        mymuteicon.style.visibility = 'hidden';

        socket.emit('action', 'unmute');
    }
})

socket.on('action', (msg, sid) => {
    if (msg == 'mute') {
        console.log(sid + ' muted themself');
        document.querySelector(`#mute${sid}`).style.visibility = 'visible';
        micInfo[sid] = 'off';
    }
    else if (msg == 'unmute') {
        console.log(sid + ' unmuted themself');
        document.querySelector(`#mute${sid}`).style.visibility = 'hidden';
        micInfo[sid] = 'on';
    }
    else if (msg == 'videooff') {
        console.log(sid + 'turned video off');
        document.querySelector(`#vidoff${sid}`).style.visibility = 'visible';
        videoInfo[sid] = 'off';
    }
    else if (msg == 'videoon') {
        console.log(sid + 'turned video on');
        document.querySelector(`#vidoff${sid}`).style.visibility = 'hidden';
        videoInfo[sid] = 'on';
    }
})

whiteboardButt.addEventListener('click', () => {
    if (boardVisisble) {
        whiteboardCont.style.visibility = 'hidden';
        boardVisisble = false;
    }
    else {
        whiteboardCont.style.visibility = 'visible';
        boardVisisble = true;
    }
})

cutCall.addEventListener('click', () => {
    location.href = '/';
})

// raise hand





// Track if the user has raised their hand
let isHandRaised = false;

// Handle "Raise Hand" button click
document.getElementById("raise-hand-btn").addEventListener("click", () => {
    isHandRaised = !isHandRaised;
    if (isHandRaised) {
        socket.emit('raiseHand', { username, roomid: params.get("room") }); // Emit raise hand event to server
    } else {
        socket.emit('lowerHand', { username, roomid: params.get("room") }); // Emit lower hand event to server
    }
});

// Receive raise hand notifications and update attendees list
socket.on('handRaised', (username) => {
    const attendeesList = document.getElementById('attendees-list');
    const attendeeItem = document.createElement('div');
    attendeeItem.classList.add('attendee-item');
    
    // Create attendee name with raised hand icon
    const attendeeName = document.createElement('span');
    attendeeName.classList.add('attendee-name');
    attendeeName.textContent = `${username}`;
    
    const raiseHandIcon = document.createElement('span');
    raiseHandIcon.classList.add('raised-hand');
    raiseHandIcon.innerHTML = '<i class="fas fa-hand-paper"></i>'; // Raised hand icon

    attendeeItem.appendChild(attendeeName);
    attendeeItem.appendChild(raiseHandIcon);

    attendeesList.appendChild(attendeeItem);
});

// Remove "raised hand" notification when user lowers hand
socket.on('handLowered', (username) => {
    const attendeesList = document.getElementById('attendees-list');
    const items = attendeesList.children;
    for (let i = 0; i < items.length; i++) {
        if (items[i].querySelector('.attendee-name').textContent === username) {
            attendeesList.removeChild(items[i]);
            break;
        }
    }
});


//attendies list 
const attendeesTab = document.getElementById("attendies-tab");
const chatTab = document.getElementById("chat-tab");
const chatContainer = document.getElementById("chat-container");
const attendeesContainer = document.getElementById("attendees-container");
const attendeesList = document.getElementById("attendees-list");

let attendees = []; // This will store the list of attendees

// Toggle between Chat and Attendees
attendeesTab.addEventListener("click", () => {
    chatContainer.style.display = "none";
    attendeesContainer.style.display = "block";
    chatTab.classList.remove("active-tab");
    attendeesTab.classList.add("active-tab");
});

chatTab.addEventListener("click", () => {
    chatContainer.style.display = "block";
    attendeesContainer.style.display = "none";
    attendeesTab.classList.remove("active-tab");
    chatTab.classList.add("active-tab");
});

// Function to update attendees list
function updateAttendeesList() {
    attendeesList.innerHTML = ""; // Clear existing list
    attendees.forEach((attendee) => {
        const li = document.createElement("li");
        li.textContent = attendee;
        li.classList.add("attendee-item");
        attendeesList.appendChild(li);
    });
}

// Simulating adding attendees (Replace this with socket event when integrating with backend)
function addAttendee(name) {
    if (!attendees.includes(name)) {
        attendees.push(name);
        updateAttendeesList();
    }
}

// Example: Simulating new attendee joining
setTimeout(() => addAttendee(username), 2000);
setTimeout(() => addAttendee(username), 4000);


//update


const overlay = document.getElementById("overlay");

const continueBtn = document.getElementById("continue-btn");





// Handle Name Submission
continueBtn.addEventListener("click", () => {
    username = nameField.value.trim();
    if (username) {
        overlay.style.display = "none"; // Hide overlay
        socket.emit("new-user", username); // Send name to the server
    } else {
        alert("Please enter a name!");
    }
});



// Function to update the attendees list
function updateAttendeesList(attendees) {
    if (Array.isArray(attendees)) {
        // Clear the previous list
        attendeesList.innerHTML = "";

        // Add each attendee to the list
        attendees.forEach((attendee) => {
            const li = document.createElement("li");
            li.textContent = attendee;
            li.classList.add("attendee-item");
            attendeesList.appendChild(li);
        });
    } else {
        console.error("Attendees list is not valid:", attendees);
    }
}

// Listen for 'update-attendees' to update the list of attendees
socket.on("update-attendees", (attendees) => {
    updateAttendeesList(attendees);
});

// Function to add a new attendee 
function addAttendee(attendeeName) {
    const li = document.createElement("li");
    li.textContent = attendeeName;
    li.classList.add("attendee-item");
    attendeesList.appendChild(li);
}

// Example usage (when user joins)
socket.on("new-attendee", (attendeeName) => {
    addAttendee(attendeeName);
});


// //recording 
// let mediaRecorder;
// let recordedChunks = [];
// let combinedStream;
// let isRecording = false;

// const startRecordingBtn = document.getElementById("start-recording-btn");
// const stopRecordingBtn = document.getElementById("stop-recording-btn");
// const screenShareBtn = document.querySelector('.screenshare');
// const whiteboardCanvas = document.getElementById('whiteboard');

// // Function to start recording the stream (Camera + Audio only)
// async function startRecording() {
//   // Grab the media stream for the camera and microphone
//   const videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

//   // Create a new stream that will contain the camera and audio
//   combinedStream = new MediaStream();

//   // Add the video and audio tracks to the combined stream
//   videoStream.getTracks().forEach(track => combinedStream.addTrack(track));

//   // Create a media recorder to record the combined stream
//   mediaRecorder = new MediaRecorder(combinedStream);

//   // Store the recorded data as chunks
//   mediaRecorder.ondataavailable = (event) => {
//     recordedChunks.push(event.data);
//   };

//   // When the recording stops, create a Blob from the chunks and generate a URL
//   mediaRecorder.onstop = () => {
//     const recordedBlob = new Blob(recordedChunks, { type: 'video/webm' });
//     const recordedURL = URL.createObjectURL(recordedBlob);

//     // Create a video element to play the recorded content
//     const recordedVideo = document.createElement('video');
//     recordedVideo.src = recordedURL;
//     recordedVideo.controls = true;
//     document.body.appendChild(recordedVideo);

//     // Create a download link for the recording
//     const downloadLink = document.createElement('a');
//     downloadLink.href = recordedURL;
//     downloadLink.download = 'meeting-recording.webm';
//     downloadLink.innerText = 'Download Recording';
//     document.body.appendChild(downloadLink);

//     console.log("Recording stopped and saved!");
//   };

//   // Start the recording
//   mediaRecorder.start();
//   console.log("Recording started...");
//   isRecording = true;

//   // Disable start button and enable stop button
//   startRecordingBtn.disabled = true;
//   stopRecordingBtn.disabled = false;
// }

// // Function to stop recording the stream
// function stopRecording() {
//   if (mediaRecorder) {
//     mediaRecorder.stop();
//     isRecording = false;

//     // Disable stop button and enable start button
//     startRecordingBtn.disabled = false;
//     stopRecordingBtn.disabled = true;
//   }
// }

// // Function to handle screen share toggle (only triggered when the user clicks the button)
// screenShareBtn.addEventListener('click', async () => {
//   if (isRecording) {
//     // Stop the screen share stream
//     const tracks = combinedStream.getVideoTracks();
//     tracks.forEach(track => track.stop());

//     // Restart the screen sharing
//     const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
//     screenStream.getTracks().forEach(track => combinedStream.addTrack(track));

//     console.log("Screen sharing started");
//   } else {
//     alert("Recording must be started before screen sharing.");
//   }
// });

// // Event listeners for starting and stopping the recording
// startRecordingBtn.addEventListener('click', startRecording);
// stopRecordingBtn.addEventListener('click', stopRecording);

// // Initialize whiteboard functionality (as before)
// function handleWhiteboardDrawing(event) {
//   const ctx = whiteboardCanvas.getContext('2d');
//   let drawing = false;
//   let lastX, lastY;

//   whiteboardCanvas.addEventListener('mousedown', (e) => {
//     drawing = true;
//     lastX = e.offsetX;
//     lastY = e.offsetY;
//   });

//   whiteboardCanvas.addEventListener('mousemove', (e) => {
//     if (!drawing) return;
//     ctx.beginPath();
//     ctx.moveTo(lastX, lastY);
//     ctx.lineTo(e.offsetX, e.offsetY);
//     ctx.stroke();
//     lastX = e.offsetX;
//     lastY = e.offsetY;
//   });

//   whiteboardCanvas.addEventListener('mouseup', () => {
//     drawing = false;
//   });

//   whiteboardCanvas.addEventListener('mouseout', () => {
//     drawing = false;
//   });
// }

// // Initialize whiteboard drawing event
// handleWhiteboardDrawing();

let mediaRecorder;
let recordedChunks = [];
let isRecording = false;
let screenStream;
let audioStream;
let combinedStream;
let videoElement = document.createElement('video');
let startRecordingBtn = document.getElementById("start-recording-btn");
let stopRecordingBtn = document.getElementById("stop-recording-btn");

async function startRecording() {
    try {
        // Request screen media (entire screen or a specific window/tab)
        screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true // Capture system audio if available
        });

        // Get the audio stream (microphone, if needed)
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Combine both screen stream and audio stream
        combinedStream = new MediaStream();
        screenStream.getTracks().forEach(track => combinedStream.addTrack(track));
        audioStream.getTracks().forEach(track => combinedStream.addTrack(track));

        // Create MediaRecorder to start recording the combined stream
        mediaRecorder = new MediaRecorder(combinedStream);

        mediaRecorder.ondataavailable = (event) => {
            recordedChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
            const recordedBlob = new Blob(recordedChunks, { type: 'video/webm' });
            const recordedURL = URL.createObjectURL(recordedBlob);

            // Create a video element to play back the recording
            videoElement.src = recordedURL;
            videoElement.controls = true;
            document.body.appendChild(videoElement);

            // Create a download link for the recording
            const downloadLink = document.createElement('a');
            downloadLink.href = recordedURL;
            downloadLink.download = 'screen-recording.webm';
            downloadLink.innerText = 'Download Recording';
            document.body.appendChild(downloadLink);

            console.log("Recording stopped and saved!");
        };

        // Start recording
        mediaRecorder.start();
        console.log("Recording started...");

        // Disable start button and enable stop button
        startRecordingBtn.disabled = true;
        stopRecordingBtn.disabled = false;

        isRecording = true;
    } catch (error) {
        console.error("Error starting screen recording: ", error);
        alert("Unable to start recording. Please check browser permissions.");
    }
}

// Stop recording
function stopRecording() {
    if (mediaRecorder) {
        mediaRecorder.stop();
        isRecording = false;

        // Stop all tracks of the combined stream
        combinedStream.getTracks().forEach(track => track.stop());

        // Disable stop button and enable start button
        startRecordingBtn.disabled = false;
        stopRecordingBtn.disabled = true;

        console.log("Recording stopped.");
    }
}

// Event listeners for start and stop buttons
startRecordingBtn.addEventListener('click', startRecording);
stopRecordingBtn.addEventListener('click', stopRecording);


//audio
// HTML Elements

const screenElement = document.createElement("video"); // Element to play screen video
const audioElement = document.createElement("audio"); // Element to play audio
let screenRecorder, audioRecorder;
let screenChunks = [], audioChunks = [];
let screenBlob, audioBlob;


// Function to start recording both screen and audio
async function startRecording() {
    try {
        // Request access to the user's microphone (audio) and screen (video)
        const audioStreamPromise = navigator.mediaDevices.getUserMedia({ audio: true });
        const screenStreamPromise = navigator.mediaDevices.getDisplayMedia({ video: true });

        // Wait for both streams to be captured
        [audioStream, screenStream] = await Promise.all([audioStreamPromise, screenStreamPromise]);

        // Create media recorders for both screen and audio streams
        screenRecorder = new MediaRecorder(screenStream);
        audioRecorder = new MediaRecorder(audioStream);

        // Push data to chunks when available
        screenRecorder.ondataavailable = (event) => {
            screenChunks.push(event.data);
        };

        audioRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        // When screen recording stops, create a Blob and provide it for playback or download
        screenRecorder.onstop = () => {
            screenBlob = new Blob(screenChunks, { type: 'video/webm' });
            const screenUrl = URL.createObjectURL(screenBlob);
            screenElement.src = screenUrl; // Attach the screen video to the element for playback
            screenElement.controls = true; // Show controls for the screen element
            document.body.appendChild(screenElement); // Append the screen video to the page

            // Download link for screen recording
            const downloadLink = document.createElement("a");
            downloadLink.href = screenUrl;
            downloadLink.download = "screen_recording.webm";
            downloadLink.textContent = "Download Screen Recording";
            document.body.appendChild(downloadLink);
        };

        // When audio recording stops, create a Blob and provide it for playback or download
        audioRecorder.onstop = () => {
            audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const audioUrl = URL.createObjectURL(audioBlob);
            audioElement.src = audioUrl; // Attach the audio to the element for playback
            audioElement.controls = true; // Show controls for the audio element
            document.body.appendChild(audioElement); // Append the audio element to the page

            // Download link for audio recording
            const downloadLink = document.createElement("a");
            downloadLink.href = audioUrl;
            downloadLink.download = "audio_recording.webm";
            downloadLink.textContent = "Download Audio Recording";
            document.body.appendChild(downloadLink);
        };

        // Start both recorders
        screenRecorder.start();
        audioRecorder.start();
        console.log("Recording started...");

        // Disable the start button while recording
        startRecordingBtn.disabled = true;
        stopRecordingBtn.disabled = false;
    } catch (err) {
        console.error("Error accessing the microphone or screen", err);
    }
}

// Function to stop recording
function stopRecording() {
    screenRecorder.stop(); // Stop screen recording
    audioRecorder.stop(); // Stop audio recording
    console.log("Recording stopped...");

    // Enable the start button again and disable the stop button
    startRecordingBtn.disabled = false;
    stopRecordingBtn.disabled = true;

    // Stop all streams (audio and video) to release the resources
    screenStream.getTracks().forEach(track => track.stop());
    audioStream.getTracks().forEach(track => track.stop());
}

// Attach event listeners to the buttons
startRecordingBtn.addEventListener("click", startRecording);
stopRecordingBtn.addEventListener("click", stopRecording);
