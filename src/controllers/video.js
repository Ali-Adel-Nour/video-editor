const path = require("node:path");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const { pipeline } = require("node:stream/promises");
const util = require("../../lib/util");
const DB = require("../DB");
const FF = require("../../lib/FF");

const getVideos = (req, res, handleErr) => {
  const videos = DB.videos.filter((video)=>{
    return video.userId === req.userId
  })
  res.status(200).json(videos)
};

// Upload a video file
const uploadVideo = async (req, res, handleErr) => {
  const specifiedFileName = req.headers.filename;
  const extension = path.extname(specifiedFileName).substring(1).toLowerCase();
  const name = path.parse(specifiedFileName).name;
  const videoId = crypto.randomBytes(4).toString("hex");

  const FORMATS_SUPPORTED = ["mov", "mp4"];

  if (FORMATS_SUPPORTED.indexOf(extension) == -1) {
    return handleErr({
      status: 400,
      message: "Only these formats are allowed: mov, mp4",
    });
  }

  try {
    await fs.mkdir(`./storage/${videoId}`);
    const fullPath = `./storage/${videoId}/original.${extension}`; // the original video path
    const file = await fs.open(fullPath, "w");
    const fileStream = file.createWriteStream();
    const thumbnailPath = `./storage/${videoId}/thumbnail.jpg`;

    await pipeline(req, fileStream);

    // Make a thumbnail for the video file
    await FF.makeThumbnail(fullPath, thumbnailPath);

    // Get the dimensions
    const dimensions = await FF.getDimensions(fullPath);

    DB.update();
    DB.videos.unshift({
      id: DB.videos.length,
      videoId,
      name,
      extension,
      dimensions,
      userId: req.userId,
      extractedAudio: false,
      resizes: {},
    });
    DB.save();

    res.status(201).json({
      status: "success",
      message: "The file was uploaded successfully!",
    });
  } catch (e) {
    // Delete the folder
    util.deleteFolder(`./storage/${videoId}`);
    if (e.code !== "ECONNRESET") return handleErr(e);
  }
};


const getVideoAsset = async (req,res,handleErr)=>{
  const videoId = req.params.get("videoId")
  const type = req.params.get("type")


  DB.update()
  const video = DB.videos.find((video)=>video.videoId === videoId)

  if(!video) return handleErr({
    status:404,
    message:"Video not found"
  })

  let file;
  let mimeType;

  switch(type){
    case "thumbnail":
       file = await fs.open(`./storage/${videoId}/thumbnail.jpg`,"r")
       mimeType = "image/jpeg"
       break;
  }

  //grab the file size
try{
  const stat = await file.stat()

  const fileStream = file.createReadStream()

  res.setHeader("Content-Type",mimeType)
  res.setHeader("Content-Length",stat.size)
  res.status(200)

  await pipeline(fileStream, res);

} catch (e) {
  console.error(e);
  handleErr({
    status: 500,
    message: "Internal server error"
  });
} finally {
  // Ensure the file handle is closed
  if (file) {
    await file.close();
  }
}
};
const controller = {
  getVideos,
  uploadVideo,
  getVideoAsset
};

module.exports = controller;
