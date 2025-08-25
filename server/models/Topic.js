const mongoose = require("mongoose");

const SyncStatusSchema = new mongoose.Schema({
    last_synced_date: { type: Date, default: null },  // when we last synced this topic
    cursor: { type: String, default: "" },            // next_cursor
    researchers_count: { type: Number, default: 0 }   // number of researchers synced for this topic
}, { _id: false });

const TopicSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    display_name: { type: String, required: true },
    field_id: { type: String, ref: "Field" },
    sync_status: { type: SyncStatusSchema, default: () => ({}) }
}, {
    timestamps: true,
    versionKey: false
});

module.exports = mongoose.model("Topic", TopicSchema);
