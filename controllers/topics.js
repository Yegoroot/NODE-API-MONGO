const ErrorResponse = require('../utils/errorResponse')
const asyncHandler = require('../middleware/async')
const Topic = require('../models/Topic')
const {createRecordDirectory, createDirectory, convertCompress} = require('../utils/fileUpload')
const Busboy = require('busboy')
const path = require('path')
const fs = require('fs')


// @desc    Create record
// @route   POST /api/v1/topics/record
// @access  Private
exports.createRecord = asyncHandler(async (req, res, next) => {
	const body = {}
	let _fileName
	const busboy = new Busboy({ headers: req.headers })

	busboy.on('field', (fieldname, val)=> {	body[fieldname] = val } )
	busboy.on('file', (fieldname, file, filename ) => {
		/* 
		* Сохраняем во временную папку 
		 */
		createDirectory('public/tmp/records/images')
		const tmp = path.join('public/tmp/records/images', filename)	
		file.pipe(fs.createWriteStream(tmp))

		file.on('end', () => {
			/**
			 * Переносим в нужную директорию
			 */
			const {programId, topicId, recordId} = body
			_fileName = `image${path.extname(filename)}`
			const imageFolder = `public/uploads/programs/${programId}/topics/${topicId}/contents/${recordId}/`
			createRecordDirectory({programId, topicId, recordId})
			fs.renameSync(tmp,  path.join(imageFolder, _fileName))	
		})
	})	
	
	busboy.on('finish', async () => {
		const {programId, topicId, recordId} = body
		const imageFolder = `public/uploads/programs/${programId}/topics/${topicId}/contents/${recordId}/`
		/**
		 * Сжимаем изображения
		 */
		await convertCompress(imageFolder, path.join(imageFolder, '/compress'))
		res.status(201).json({success: true, image: `/topics/${topicId}/contents/${recordId}/compress/${_fileName}?${new Date().getTime()}`})
	})
	req.pipe(busboy)

})


// @desc    Get single topic
// @route   GET /api/v1/topics/:id
// @access  Public
exports.getMyTopic =  asyncHandler(async (req, res, next) => {

	const params = {}
	if (req.user.role !== 'superadmin') {
		params.user = req.user._id
	}

	const topic = await Topic.findOne({_id: req.params.id, ...params})
		.populate({
			path: 'program',
			select: 'title'
		})
		.populate({
			path: 'user',
			select: 'name'
		})
	if(!topic) {	
		return	next(new ErrorResponse(`Topic not found with of id ${req.params.id}`, 404))
	}
	res.status(200).json({success: true, data: topic})
})


// @desc    Get all topics
// @route   GET /api/v1/topics
// @access  Public
exports.getTopics = asyncHandler(async (req, res, next) => {

	req.requestModel.populate([
		{ path: 'program', 
			select: 'title description'
		},
		{ path: 'user', select: 'name email' }
	])
	
	const topics = await req.requestModel
		
	res.status(200).json({
		success: true,
		count: topics.length,
		total: req.total,
		data: topics
	})
	
})

// @desc    Get single topic
// @route   GET /api/v1/topics/:id
// @access  Public
exports.getTopic =  asyncHandler(async (req, res, next) => {
	const topic = await Topic.findById(req.params.id)
		.populate({
			path: 'program',
			select: 'title'
		})
		.populate({
			path: 'user',
			select: 'name'
		})
	if(!topic || !topic.publish) {	
		return	next(new ErrorResponse(`Topic not found with of id ${req.params.id}`, 404))
	}
	res.status(200).json({success: true, data: topic})
})

// @desc    Create topic
// @route   POST /api/v1/topics/:id
// @access  Private
exports.createTopic = asyncHandler(async (req, res, next) => {
	// Add user to req.body
	req.body.user = req.user.id
	
	if(req.body.sections) {
		req.body.sections =  JSON.parse(req.body.sections)
	}
	const topic = await Topic.create(req.body)
	res.status(201).json({success: true, data: topic})
})

// @desc    Update topic
// @route   PUT /api/v1/topics/:id
// @access  Private
exports.updateTopic = asyncHandler(async (req, res, next) => {
	let topic = await Topic.findById(req.params.id)
	if (!topic) {
		return	next(new ErrorResponse(`Topic not found with of id ${req.params.id}`, 404))
	}
	// Make shure user is owner
	if (topic.user.toString() !== req.user.id && req.user.role !== 'superadmin') {
		return	next(new ErrorResponse(`This user is not allowed to work with ${req.params.id}`, 401))
	}
	topic = await Topic.findByIdAndUpdate(req.params.id, req.body, {
		new: true,
		runValidators: true
	})
	return res.status(200).json({success: true, data: topic})
})

// @desc    Delete topic
// @route   DELETE /api/v1/topics/:id
// @access  Private
exports.deleteTopic = asyncHandler(async (req, res, next) => {
	const topic = await Topic.findById(req.params.id)
	if (!topic) {
		return	next(new ErrorResponse(`Topic not found with of id ${req.params.id}`, 404))
	}
	if (topic.user.toString() !== req.user.id && req.user.role !== 'superadmin') {
		return	next(new ErrorResponse(`This user is not allowed to work with ${req.params.id}`, 401))
	}
	await topic.remove()
	return res.status(200).json({success: true, data: {}})
})

// @desc    Delete topics
// @route   DELETE /api/v1/topics/?ids=1,2
// @access  Private
exports.deleteTopics = asyncHandler(async (req, res, next) => {
	const ids = req.query.ids.split(',')
	if ( req.user.role !== 'superadmin') {
		return	next(new ErrorResponse(`This user is not allowed to work with ${ids}`, 401))
	}
	await Topic.deleteMany(
		{	_id: {	$in: ids	}	},
		(error, result) => {
			if (error) {
				return	next(new ErrorResponse(`${error.message}`, 500))
			} else {
				res.status(200).json({success: true, data: {}})
			}
		}
	)
})
