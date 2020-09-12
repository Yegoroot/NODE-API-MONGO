const express = require('express')
const Program = require('../models/Program')
const router = express.Router()
const { 
	getPrograms, 
	getProgram, 
	createProgram, 
	updateProgram, 
	deleteProgram,
	getMyProgram
} = require('../controllers/programs')

const {requestModel} = require('../middleware/query')
const { isAuth, haveAccess } = require('../middleware/auth')
const { photoUploadProtect } = require('../middleware/photoUploadProtect')

const theseHaveAccess = ['superadmin', 'admin', 'teacher']


router.route('/')        
	.get(requestModel(Program), getPrograms)      
	.post(isAuth, haveAccess(...theseHaveAccess), photoUploadProtect, createProgram)
	.delete(isAuth, haveAccess(...theseHaveAccess))

router.route('/my')
	.get(isAuth, haveAccess(...theseHaveAccess), requestModel(Program, 'my'),  getPrograms)
router.route('/my/:id')
	.get(isAuth, haveAccess(...theseHaveAccess), getMyProgram)

router.route('/:id')	
	.get(getProgram)
	.put(isAuth, haveAccess(...theseHaveAccess), photoUploadProtect, updateProgram)
	.delete(isAuth, haveAccess(...theseHaveAccess), deleteProgram)

module.exports = router