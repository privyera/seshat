// Copyright 2019 The Matrix.org Foundation C.I.C.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const seshat = require('../native');


/**
 * @typedef searchResult
 * @type {Object}
 * @property {string} next_batch A token that can be used to grab more results
 * in the next search call.
 * @property {number} count The total number of results that were found.
 * @property {Array.<singleResult>} results The list of results that was found.
 */

/**
 * @typedef singleResult
 * @type {Object}
 * @property {number} rank The rank of the search result.
 * @property {matrixEvent} result The full event of the search result.
 * @property {searchContext} context The context of the result, containing
 * events before and after the result.
 */

/**
 * @typedef searchContext
 * @type {Object}
 * @property {Array.<matrixEvent>} events_before Events that happened before the
 * search result.
 * @property {Array.<matrixEvent>} events_after Events that happened after the
 * search result.
 * @property {{user_id: matrixProfile}} profile_info The historic profile
 * information of the users that sent the events returned.
 */

/**
 * @typedef matrixEvent
 * @type {Object}
 * @property {string} event_id The unique ID of the event.
 * @property {string} sender The MXID of the user who sent this event.
 * @property {string} room_id The ID of the room where the event was sent.
 * @property {number} origin_server_ts The timestamp in milliseconds of the
 * originating homeserver when this event was sent.
 * @property {Object} content The content of the event. The content needs to
 * have either a body, topic or name key.
 */


/**
 * @typedef matrixProfile
 * @type {Object}
 * @property {string} displayname The users display name, if one is set.
 * @property {string} avatar_url The users avatar url, if one is set.
 */


/**
 * @typedef checkpoint
 * @type {Object}
 * @property {string} roomId The unique id of the room that this checkpoint
 * belongs to.
 * @property {string} token The token that can be used to fetch more events for
 * the given room.
 * @property {boolean} fullCrawl Is this checkpoint of a crawl that should
 * re-crawl the complete room history.
 * @property {string} direction The crawl direction of the checkpoint. Can be
 * one of "b" or "f".
 */

/**
 * @typedef loadResult
 * @type {Object}
 * @property {matrixEvent} event A matrix event that was loaded from the
 * database.
 * @property {matrixProfile} profile The profile of the sender at the time the
 * event was sent.
 */

/**
 * @typedef databaseStats
 * @type {Object}
 * @property {number} size The number of bytes that the database is consuming on
 * the disk.
 * @property {number} eventCount The number events that are stored in the
 * database.
 * @property {number} roomCount The number of rooms the database knows about.
 */

/**
 * @typedef recoveryInfo
 * @type {Object}
 * @property {number} totalEvents The total number of events that the database
 * holds.
 * @property {number} reindexedEvents The number of events that have been
 * reindexed.
 * @property {number} done The percentage showing the re-index progress.
 */

/**
 * Seshat re-index error.<br>
 *
 * This error will be thrown if a Seshat database can't be opened because it
 * needs to be re-indexed.
 *
 * The database can be opened as a recovery database with the SeshatRecovery
 * class. This class provides method to re-index the database.
 *
 */
class ReindexError extends Error {
    /**
     * Create a new ReindexError
     */
    constructor(...params) {
        super(...params);

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ReindexError);
        }
        this.name = 'ReindexError';
        this.message = 'The Seshat database needs to be reindexed.';
    }
}

/**
 * Seshat database.<br>
 *
 * A Seshat database can be used to store and index Matrix events. A full-text
 * search can be done on the database retrieving events that match a search
 * query.
 */
class Seshat extends seshat.Seshat {
    /**
     * Open an existing or create a new Seshat database.
     *
     * @param {string} path The path where the database should be stored. If a
     * database already exist in the given folder the database will be reused.
     * @param {object} config Additional configuration for the database.
     * database already exist in the given folder the database will be reused.
     * @param  {string} config.language The language that the database should
     * use for indexing. Picking the correct indexing language may improve the
     * search.  @param  {string} config.passphrase The passphrase that should be
     * used to encrypt the database. The database is left unencrypted it no
     * passphrase is set.
     *
     * @constructor
     *
     * @example
     * // create a Seshat database in the given folder
     * let db = new Seshat("/home/example/database_dir");
     * // Add a Matrix event to the database.
     * db.addEvent(textEvent, profile);
     * // Commit events waiting in the queue to the database.
     * await db.commit();
     * // Search the database for messages containing the word 'Test'
     * let results = await db.search('Test');
     */
    constructor(path, config = undefined) {
        config = config || {};
        try {
            super(path, config);
        } catch (e) {
            // The Rust side throws a RangeError, this is a bit silly so convert
            // it to a custom error.
            if (e.constructor.name === 'RangeError') {
                throw new ReindexError();
            } else {
                throw e;
            }
        }
    }
    /**
     * Add an event to the database.
     *
     * This method adds an event only to a queue. To write the events to the
     * database the <code>commit()</code> methods needs to be called.
     *
     * @param  {matrixEvent} matrixEvent A Matrix event that should be added to
     * the database.
     * @param  {matrixProfile} profile The user profile of the sender at the
     * time the event was sent.
     *
     * @return {Void}
     */
    addEvent(matrixEvent, profile = {}) {
        return super.addEvent(matrixEvent, profile);
    };

    /**
     * Delete an event from the database.
     *
     * This method adds an event only to a queue. To write the events to the
     * database the <code>commit()</code> methods needs to be called.
     *
     * @param  {string} eventId The unique id of the event that should be
     * deleted from the database.
     *
     * @return {Promise<boolean>} A boolean indicating if the event was removed
     * from the index or if a commit later on will be needed.
     */
    async deleteEvent(eventId) {
        return new Promise((resolve, reject) => {
            super.deleteEvent(eventId, (err, res) => {
                if (err) reject(err);
                else resolve(res);
            });
        });
    };

    /**
     * Commit the queued up events to the database.
     *
     * This is the asynchronous equivalent of the <code>commitSync()</code>
     * method.
     *
     * @param  {boolean} force Force the commit, commits to the index are
     * usually rate limited. This gets around the limit and forces the
     * documents to be added to the index. This should only be used for testing
     * purposes.
     *
     * @return {Promise<number>} The latest stamp of the commit. The stamp is
     * a unique incrementing number that identifies the commit.
     */
    async commit(force = false) {
        return new Promise((resolve, reject) => {
            super.commit(force, (err, res) => {
                resolve(res);
            });
        });
    }

    /**
     * Commit the queued up events to the database.
     *
     * @param  {boolean} wait Wait for the events to be committed. If true will
     * block until the events are committed.
     * @param  {boolean} force Force the commit, commits to the index are
     * usually rate limited. This gets around the limit and forces the
     * documents to be added to the index. This should only be used for testing
     * purposes.
     *
     * @return {number} The latest stamp of the commit. The stamp is a unique
     * incrementing number that identifies the commit.
     */
    commitSync(wait = false, force = false) {
        return super.commitSync(wait, force);
    }

    /**
     * Reload the indexer of the database to reflect the changes of the last
     * commit. A reload will happen automatically, this method is mainly useful
     * for unit testing purposes to force a reload before a search.
     */
    reload() {
        super.reload();
    };

    /**
     * Search the database for events using the given search term.
     * This is the asynchronous equivalent of the <code>searchSync()</code>
     * method.
     *
     * @param  {object} args Arguments object for the search.
     * @param  {string} args.searchTerm The term that is used to search the
     * database.
     * @param  {number} args.limit The maximum number of events that the search
     * should return.
     * @param  {number} args.before_limit The number of events to fetch that
     * preceded the event that matched the search term.
     * @param  {number} args.after_limit The number of events to fetch that
     * followed the event that matched the search term.
     * @param  {boolean} args.order_by_recency Should the search results be
     * ordered by event recency.
     * @param  {string} args.next_batch Should the search results be
     * ordered by event recency.
     *
     * @return {Promise<searchResult>} The array of events that matched
     * the search term.
     */
    async search(args) {
        return new Promise((resolve, reject) => {
            super.search(args, (err, res) => {
                if (err) reject(err);
                else resolve(res);
            });
        });
    }

    /**
     * Search the database for events using the given search term.
     *
     * @param  {string} term The term that is used to search the database.
     * @param  {number} limit The maximum number of events that the search
     * should return.
     * @param  {number} before_limit The number of events to fetch that
     * preceded the event that matched the search term.
     * @param  {number} after_limit The number of events to fetch that followed
     * the event that matched the search term.
     * @param  {boolean} order_by_recency Should the search results be ordered
     * by event recency.
     *
     * @return {searchResult} The array of events that matched the
     * search term.
     */
    searchSync(term, limit = 10, before_limit = 0, after_limit = 0,
        order_by_recency = false) {
        return super.searchSync(term, limit, before_limit, after_limit,
            order_by_recency);
    }

    /**
     * Add a batch of events from the room history to the database.
     *
     * @param  {array<matrixEvent>} events An array of events that will be
     * added to the database.
     * @param  {checkpoint} newCheckpoint
     * @param  {checkpoint} oldCheckPoint
     *
     * @return {boolean} True if the added events were already in the store,
     * false otherwise.
     */
    addHistoricEventsSync(events, newCheckpoint = null, oldCheckPoint = null) {
        return super.addHistoricEventsSync(events, newCheckpoint,
            oldCheckPoint);
    }

    /**
     * Add a batch of events from the room history to the database.
     *
     * @param  {array<matrixEvent>} events An array of events that will be
     * added to the database.
     * @param  {checkpoint} newCheckpoint
     * @param  {checkpoint} oldCheckPoint
     *
     * @return {Promise<boolean>} A promise that will resolve to true if all
     * the events have already been added to the database, false otherwise.
     */
    async addHistoricEvents(events, newCheckpoint = null,
        oldCheckPoint = null) {
        return new Promise((resolve, reject) => {
            super.addHistoricEvents(
                events,
                newCheckpoint,
                oldCheckPoint,
                (err, res) => {
                    if (err) reject(err);
                    else resolve(res);
                },
            );
        });
    }

    /**
     * Add a message crawler checkpoint.
     *
     * @param  {checkpoint} checkpoint
     *
     * @return {Promise} A promise that will resolve when the checkpoint has
     * been stored in the database.
     */
    async addCrawlerCheckpoint(checkpoint) {
        return this.addHistoricEvents([], checkpoint);
    }

    /**
     * Remove a message crawler checkpoint.
     * @param  {checkpoint} checkpoint
     *
     * @return {Promise} A promise that will resolve when the checkpoint has
     * been removed from the database.
     */
    async removeCrawlerCheckpoint(checkpoint) {
        return this.addHistoricEvents([], null, checkpoint);
    }

    /**
     * Load the stored crawler checkpoints.
     * @param  {checkpoint} checkpoint
     *
     * @return {Promise<Array.<checkpoint>>} A promise that will resolve to an
     * array of checkpoints when they are loaded from the database.
     */
    async loadCheckpoints() {
        return new Promise((resolve, reject) => {
            super.loadCheckpoints((err, res) => {
                if (err) reject(err);
                else resolve(res);
            });
        });
    }

    /**
     * Get the size of the database.
     * This returns the number of bytes the database is using on disk.
     *
     * @return {Promise<number>} A promise that will resolve to the database
     * size in bytes.
     */
    async getSize() {
        return new Promise((resolve, reject) => {
            super.getSize((err, res) => {
                if (err) reject(err);
                else resolve(res);
            });
        });
    }

    /**
     * Get statistical information of the database.
     *
     * @return {Promise<databaseStats>} A promise that will resolve to an object
     * containing statistical information of the database.
     */
    async getStats() {
        return new Promise((resolve, reject) => {
            super.getStats((err, res) => {
                if (err) reject(err);
                else resolve(res);
            });
        });
    }

    /**
     * Delete the Seshat database.
     *
     * @return {Promise} A promise that will resolve when the database has
     * been deleted.
     */
    async delete() {
        return new Promise((resolve, reject) => {
            super.delete((err, res) => {
                if (err) reject(err);
                else resolve(res);
            });
        });
    }

    /**
     * Shutdown and close the Seshat database.
     *
     * @return {Promise} A promise that will resolve when the database has
     * been closed.
     */
    async shutdown() {
        return new Promise((resolve, reject) => {
            super.shutdown((err, res) => {
                if (err) reject(err);
                else resolve(res);
            });
        });
    }

    /**
     * Change the passphrase of the database
     *
     * This will also close the database, just like shutdown does.
     *
     * @param  {string} newPassphrase The new passphrase that should from now on
     * be used to encrypt the database.
     *
     * @return {Promise} A promise that will resolve when the passphrase has
     * been changed.
     */
    async changePassphrase(newPassphrase) {
        return new Promise((resolve, reject) => {
            super.changePassphrase(newPassphrase, (err, res) => {
                if (err) reject(err);
                else resolve(res);
            });
        });
    }

    /**
     * Check if the database is completely empty.
     *
     * @return {Promise<boolean>} A promise that will resolve to true if the
     * database is empty, that is, it doesn't contain any events, false
     * otherwise.
     */
    async isEmpty() {
        return new Promise((resolve, reject) => {
            super.isEmpty((err, res) => {
                if (err) reject(err);
                else resolve(res);
            });
        });
    }

    /**
     * Check if the room with the given id is already indexed.
     *
     * @param  {string} roomId The ID of the room which we want to check if it
     * has been already indexed.
     *
     * @return {Promise<boolean>} A promise that will resolve to true if the
     * database contains events for the given room, false otherwise.
     */
    async isRoomIndexed(roomId) {
        return new Promise((resolve, reject) => {
            super.isRoomIndexed(roomId, (err, res) => {
                if (err) reject(err);
                else resolve(res);
            });
        });
    }

    /**
     * Load events that contain an mxc URL to a file.
     *
     * @param  {object} args Arguments object for the method.
     * @param  {string} args.roomId The ID of the room for which the events
     * should be loaded.
     * @param  {number} args.limit The maximum number of events to return.
     * @param  {string} args.fromEvent An event id of a previous event returned
     * by this method. If set events that are older than the event with the
     * given event ID will be returned.
     * @param {string} args.direction The direction that we are going to
     * continue lading events to. Can be either "backwards", "b", "forwards" or
     * "f".
     *
     * @return {Promise<[loadResult]>} A promise that will resolve to an array
     * of Matrix events that contain mxc URLs.
     */
    async loadFileEvents(args) {
        return new Promise((resolve, reject) => {
            super.loadFileEvents(args, (err, res) => {
                if (err) reject(err);
                else resolve(res);
            });
        });
    }
}

/**
 * Seshat recovery database.<br>
 *
 * A Seshat recovery database can be used to re-index a Seshat database.
 *
 * This will be needed if schema changes to the index were required and the
 * library has been upgraded.
 *
 * The recovery database uses the same parameters in the constructor like the
 * normal Seshat database.
 *
 * @param {string} path The path where the database should be stored. If a
 * database already exist in the given folder the database will be reused.
 * @param {object} config Additional configuration for the database.
 * database already exist in the given folder the database will be reused.
 * @param  {string} config.language The language that the database should use
 * for indexing. Picking the correct indexing language may improve the search.
 * @param  {string} config.passphrase The passphrase that should be used to
 * encrypt the database. The database is left unencrypted it no passphrase is
 * set.
 *
 * @constructor
 *
 * @example
 * // open a Seshat recovery database in the given folder
 * let recovery = new SeshatRecovery("/home/example/database_dir");
 * // reindex the database
 * await recovery.reindex();
 */
class SeshatRecovery extends seshat.SeshatRecovery {
    /**
     * Get info about the re-index status.
     *
     * @return {RecoveryInfo} A object that holds the number of total events,
     * re-indexed events and the done percentage.
     */
    info() {
        return super.info();
    }

    /**
     * Re-index the database.
     *
     * @return {Promise} A promise that will resolve once the database has
     * been re-indexed.
     */
    async reindex() {
        return new Promise((resolve, reject) => {
            super.reindex((err, res) => {
                if (err) reject(err);
                else resolve(res);
            });
        });
    }
}

module.exports = {
    Seshat: Seshat,
    SeshatRecovery: SeshatRecovery,
    ReindexError: ReindexError,
};
