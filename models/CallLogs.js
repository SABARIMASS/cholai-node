
const mongoose = require('mongoose');

const CallHistorySchema = new mongoose.Schema(
  {
    callSessionId: { type: String, required: true, unique: true },
    callerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    callType: { type: String, enum: ["audio", "video"], required: true },
    status: { 
      type: String, 
      enum: ["completed", "missed", "rejected", "failed","ongoing"], 
      default: "missed" 
    },
    startTime: { type: Date },
    endTime: { type: Date },
    durationSeconds: { type: Number },
    disconnectReason: { type: String },
  },
  { timestamps: true }
);



const CallLogs = mongoose.model('CallHistory', CallHistorySchema);

module.exports = CallLogs;


module.exports = mongoose.model('CallHistory', CallHistorySchema);
