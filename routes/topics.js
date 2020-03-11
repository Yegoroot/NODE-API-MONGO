const express = require('express')
const router = express.Router()

const { getTopics, getTopic, createTopic, updateTopic, deleteTopic } = require('../controllers/topics')

// Include other resource
const NoteRouter = require('./notes')

// Re-route into other resourse router
router.use('/:topicId/notes', NoteRouter)

router.route('/')        
	.get(getTopics)
	.post(createTopic)

router.route('/:id')	
	.get(getTopic)
	.put(updateTopic)
	.delete(deleteTopic)

module.exports = router