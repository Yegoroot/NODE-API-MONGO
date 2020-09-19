const ErrorResponse = require('../utils/errorResponse')
const asyncHandler = require('../middleware/async')
const Program = require('../models/Program')
const {createProgramPhotoDirectories, pathProgram, convertCompress} = require('../utils/fileUpload')
const Busboy = require('busboy')
const fs = require('fs')
const path = require('path')


// @desc    Get all my program
// @route   GET /api/v1/programs/my/:id
// @access  Public
exports.getMyProgram = asyncHandler(async (req, res, next) => {

	const params = {}
	if (req.user.role !== 'superadmin') {
		params.user = req.user._id
	}

	const program = await Program.findOne({ _id: req.params.id, ...params})
		.populate({	path: 'topics',	select: 'title description photo'})
		.populate({	path: 'user',	select: 'name email' })
		.populate({ path: 'types', select: 'title alias color' })

	if(!program) {	
		return	next(new ErrorResponse(`Program not found with of id ${req.params.id}`, 404))
	}
	res.status(200).json({success: true, data: program})
})


// @desc    Get all programs
// @route   GET /api/v1/programs
// @access  Public
exports.getPrograms = asyncHandler(async (req, res, next) => {
	req.requestModel.populate([
		{ path: 'topics', select: 'title description photo -program' },
		{ path: 'user', select: 'name email' },
		{ path: 'types', select: 'title alias color' }
	])
	const programs = await req.requestModel
	res.status(200).json({
		success: true,
		count: programs.length,
		total: req.total,
		data: programs
	})
})


// @desc    Get single program
// @route   GET /api/v1/program/:id
// @access  Public
exports.getProgram =  asyncHandler(async (req, res, next) => {
	const program = await Program.findById(req.params.id)
		.populate({
			path: 'topics',
			// populate: {path: 'program',	select: 'title'}, // populate of populate
			select: 'title description'
		})
		.populate({
			path: 'user',
			select: 'name email'
		})
		.populate({
			path: 'types',
			select: 'title alias color'
		})
	if(!program || !program.publish) {	
		return	next(new ErrorResponse(`Program not found with of id ${req.params.id}`, 404))
	}
	res.status(200).json({success: true, data: program})
})


// @desc    Create program
// @route   POST /api/v1/program/:id
// @access  Private
exports.createProgram = asyncHandler(async (req, res, next) => {

	const program = new Program({})
	// user from previous middleware
	program.user = req.user.id 
	// create special folder for program
	createProgramPhotoDirectories(program.id)

	const busboy = new Busboy({ headers: req.headers })

	busboy.on('file', function(fieldname, file, filename) {
		// SAVE PHOTO
		const _fileName = `photo${path.extname(filename)}` 
		const saveFileTo = path.join(pathProgram(program.id), '/photo', _fileName);	file.pipe(fs.createWriteStream(saveFileTo))
		program.photo = _fileName	
	})

	busboy.on('field', function(fieldname, val) {
		program[fieldname] = val
		if (fieldname === 'types') {
			program[fieldname] = JSON.parse(val)
		} 
	})

	busboy.on('finish', () => {
		program.save( async (error) => {
			
			if (error)  {
				fs.rmdirSync(pathProgram(program.id), { recursive: true })
				return res.status(400).json({success: false, error: JSON.stringify(error) })
			}
			// CONVERT AND COMPRESS 
			const from = `public/uploads/programs/${program.id}/photo/*.{jpg,JPG,png,PNG,jpeg,JPEG}`
			const to =  `public/uploads/programs/${program.id}/photo/compress`
			await convertCompress(from, to)
			res.status(201).json({success: true, data: program })
		})
	})
	req.pipe(busboy)
})


// @desc    Update program
// @route   PUT /api/v1/programs/:id
// @access  Private
exports.updateProgram = asyncHandler(async (req, res, next) => {
	let program = await Program.findById(req.params.id)
	
	if (!program) {
		return	next(new ErrorResponse(`Program not found with of id ${req.params.id}`, 404))
	}
	// Make shure user is owner
	if (program.user.toString() !== req.user.id && req.user.role !== 'superadmin') {
		return	next(new ErrorResponse(`This user is not allowed to work with ${req.params.id}`, 403))
	}
	
	createProgramPhotoDirectories(program.id) // check if no - create
	
	/**
	 * ----------------
	 */
	const busboy = new Busboy({ headers: req.headers })

	busboy.on('file', function(fieldname, file, filename) {
		// SAVE PHOTO
		const _fileName = `photo${path.extname(filename)}` 
		const saveFileTo = path.join(pathProgram(program.id), '/photo', _fileName);	file.pipe(fs.createWriteStream(saveFileTo))
		program.photo = `${_fileName}?${new Date().getTime()}`	
	})

	busboy.on('field', function(fieldname, val) {
		program[fieldname] = val
		if (fieldname === 'types') {
			program[fieldname] = JSON.parse(val)
		} 
	})
	
	busboy.on('finish', async function() {
		try {			
			program = await Program.findByIdAndUpdate(req.params.id, program, {
				new: true,
				runValidators: true
			})
			// CONVERT AND COMPRESS 
			const from = `public/uploads/programs/${program.id}/photo/*.{jpg,JPG,png,PNG,jpeg,JPEG}`
			const to =  `public/uploads/programs/${program.id}/photo/compress`
			await convertCompress(from, to)
			res.status(200).json({success: true, data: program})
		} catch (error) {
			res.status(400).json({success: false, error: JSON.stringify(error) || 'Here Error'})	
		}
	})
	req.pipe(busboy)
	/**
	 * ----------------
	 */
})


// @desc    Delete program
// @route   DELETE /api/v1/programs/:id
// @access  Private
exports.deleteProgram = asyncHandler(async (req, res, next) => {
	const program = await Program.findById(req.params.id)
	if (!program) {
		return	next(new ErrorResponse(`Program not found with of id ${req.params.id}`, 404))
	}
	if (program.user.toString() !== req.user.id && req.user.role !== 'superadmin') { 	// Make shure user is owner
		return	next(new ErrorResponse(`This user is not allowed to work with ${req.params.id}`, 401))
	}
	program.remove() // не используем deleteByID потому что не сработает событие .pre('remove',
	fs.rmdirSync(pathProgram(program.id), { recursive: true })
	return res.status(200).json({success: true, data: {}})
})
