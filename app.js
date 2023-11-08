const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "asdflkj", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;

        next();
      }
    });
  }
};

//Registe_API!!!

app.post("/register/", async (request, response) => {
  const { username, name, password, gender } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const createUserQuery = `
      INSERT INTO 
        user (username, password, name, gender) 
      VALUES 
        (
          '${username}', 
          '${hashedPassword}', 
          '${name}',
          '${gender}'
        )`;

      const dbResponse = await db.run(createUserQuery);

      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//login api
app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "asdflkj");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//get method
//API 3
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username } = request;
  const getUserIdQuery = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  const getFollowerIdsQuery = `select following_user_id from follower 
    where follower_user_id=${getUserId.user_id};`;
  const getFollowerIds = await db.all(getFollowerIdsQuery);
  const getFollowerIdsSimple = getFollowerIds.map((eachUser) => {
    return eachUser.following_user_id;
  });
  console.log(getFollowerIdsSimple);
  const getTweetQuery = `select user.username, tweet.tweet, tweet.date_time as dateTime 
      from user inner join tweet 
      on user.user_id= tweet.user_id where user.user_id in (${getFollowerIdsSimple})
       order by tweet.date_time desc limit 4;`;
  const responseResult = await db.all(getTweetQuery);
  response.send(responseResult);
});

//api4

app.get("/user/following/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  // console.log(getUserId);
  const getFollowerIdsQuery = `select following_user_id from follower 
    where follower_user_id=${getUserId.user_id};`;
  const getFollowerIdsArray = await db.all(getFollowerIdsQuery);
  //console.log(getFollowerIdsArray);
  const getFollowerIds = getFollowerIdsArray.map((eachUser) => {
    return eachUser.following_user_id;
  });
  //console.log(`${getFollowerIds}`);
  const getFollowersResultQuery = `select name from user where user_id in (${getFollowerIds});`;
  const responseResult = await db.all(getFollowersResultQuery);
  //console.log(responseResult);
  response.send(responseResult);
});

//api5

app.get("/user/followers/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  //console.log(getUserId);
  const getFollowerIdsQuery = `select follower_user_id from follower where following_user_id=${getUserId.user_id};`;
  const getFollowerIdsArray = await db.all(getFollowerIdsQuery);
  console.log(getFollowerIdsArray);
  const getFollowerIds = getFollowerIdsArray.map((eachUser) => {
    return eachUser.follower_user_id;
  });
  console.log(`${getFollowerIds}`);
  //get tweet id of user following x made
  const getFollowersNameQuery = `select name from user where user_id in (${getFollowerIds});`;
  const getFollowersName = await db.all(getFollowersNameQuery);
  //console.log(getFollowersName);
  response.send(getFollowersName);
});

//api 6
const api6Output = (tweetData, likesCount, replyCount) => {
  return {
    tweet: tweetData.tweet,
    likes: likesCount.likes,
    replies: replyCount.replies,
    dateTime: tweetData.date_time,
  };
};

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  //console.log(tweetId);
  let { username } = request;
  const getUserIdQuery = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  // console.log(getUserId);
  //get the ids of whom the use is following
  const getFollowingIdsQuery = `select following_user_id from follower where follower_user_id=${getUserId.user_id};`;
  const getFollowingIdsArray = await db.all(getFollowingIdsQuery);
  //console.log(getFollowingIdsArray);
  const getFollowingIds = getFollowingIdsArray.map((eachFollower) => {
    return eachFollower.following_user_id;
  });
  //console.log(getFollowingIds);
  //get the tweets made by the users he is following
  const getTweetIdsQuery = `select tweet_id from tweet where user_id in (${getFollowingIds});`;
  const getTweetIdsArray = await db.all(getTweetIdsQuery);
  const followingTweetIds = getTweetIdsArray.map((eachId) => {
    return eachId.tweet_id;
  });
  // console.log(followingTweetIds);
  //console.log(followingTweetIds.includes(parseInt(tweetId)));
  if (followingTweetIds.includes(parseInt(tweetId))) {
    const likes_count_query = `select count(user_id) as likes from like where tweet_id=${tweetId};`;
    const likes_count = await db.get(likes_count_query);
    //console.log(likes_count);
    const reply_count_query = `select count(user_id) as replies from reply where tweet_id=${tweetId};`;
    const reply_count = await db.get(reply_count_query);
    // console.log(reply_count);
    const tweet_tweetDateQuery = `select tweet, date_time from tweet where tweet_id=${tweetId};`;
    const tweet_tweetDate = await db.get(tweet_tweetDateQuery);
    //console.log(tweet_tweetDate);
    response.send(api6Output(tweet_tweetDate, likes_count, reply_count));
  } else {
    response.status(401);
    response.send("Invalid Request");
    console.log("Invalid Request");
  }
});

//api 7
const convertLikedUserNameDBObjectToResponseObject = (dbObject) => {
  return {
    likes: dbObject,
  };
};
app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    let { username } = request;
    const getUserIdQuery = `select user_id from user where username='${username}';`;
    const getUserId = await db.get(getUserIdQuery);
    const getFollowingIdsQuery = `select following_user_id from follower where follower_user_id=${getUserId.user_id};`;
    const getFollowingIdsArray = await db.all(getFollowingIdsQuery);
    const getFollowingIds = getFollowingIdsArray.map((eachFollower) => {
      return eachFollower.following_user_id;
    });
    const getTweetIdsQuery = `select tweet_id from tweet where user_id in (${getFollowingIds});`;
    const getTweetIdsArray = await db.all(getTweetIdsQuery);
    const getTweetIds = getTweetIdsArray.map((eachTweet) => {
      return eachTweet.tweet_id;
    });
    if (getTweetIds.includes(parseInt(tweetId))) {
      const getLikedUsersNameQuery = `select user.username as likes from user inner join like
       on user.user_id=like.user_id where like.tweet_id=${tweetId};`;
      const getLikedUserNamesArray = await db.all(getLikedUsersNameQuery);
      const getLikedUserNames = getLikedUserNamesArray.map((eachUser) => {
        return eachUser.likes;
      });
      response.send(
        convertLikedUserNameDBObjectToResponseObject(getLikedUserNames)
      );
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//api 8
const convertUserNameReplyedDBObjectToResponseObject = (dbObject) => {
  return {
    replies: dbObject,
  };
};
app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    //tweet id of which we need to get reply's
    const { tweetId } = request.params;
    console.log(tweetId);
    //user id from user name
    let { username } = request;
    const getUserIdQuery = `select user_id from user where username='${username}';`;
    const getUserId = await db.get(getUserIdQuery);
    // console.log(getUserId);
    //get the ids of whom the user is following
    const getFollowingIdsQuery = `select following_user_id from follower where follower_user_id=${getUserId.user_id};`;
    const getFollowingIdsArray = await db.all(getFollowingIdsQuery);
    //console.log(getFollowingIdsArray);
    const getFollowingIds = getFollowingIdsArray.map((eachFollower) => {
      return eachFollower.following_user_id;
    });
    console.log(getFollowingIds);
    //check if the tweet ( using tweet id) made by the person he is  following
    const getTweetIdsQuery = `select tweet_id from tweet where user_id in (${getFollowingIds});`;
    const getTweetIdsArray = await db.all(getTweetIdsQuery);
    const getTweetIds = getTweetIdsArray.map((eachTweet) => {
      return eachTweet.tweet_id;
    });
    console.log(getTweetIds);
    //console.log(getTweetIds.includes(parseInt(tweetId)));
    if (getTweetIds.includes(parseInt(tweetId))) {
      //get reply's
      //const getTweetQuery = `select tweet from tweet where tweet_id=${tweetId};`;
      //const getTweet = await database.get(getTweetQuery);
      //console.log(getTweet);
      const getUsernameReplyTweetsQuery = `select user.name, reply.reply from user inner join reply on user.user_id=reply.user_id
      where reply.tweet_id=${tweetId};`;
      const getUsernameReplyTweets = await db.all(getUsernameReplyTweetsQuery);
      //console.log(getUsernameReplyTweets);
      /* console.log(
        convertUserNameReplyedDBObjectToResponseObject(getUsernameReplyTweets)
      );*/

      response.send(
        convertUserNameReplyedDBObjectToResponseObject(getUsernameReplyTweets)
      );
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//api 6
const api7Output = (tweetData, likesCount, replyCount) => {
  return {
    tweet: tweetData.tweet,
    likes: likesCount.likes,
    replies: replyCount.replies,
    dateTime: tweetData.date_time,
  };
};

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const myTweets = await db.all(`
		select
		tweet.tweet,
		count(distinct like.like_id) as likes,
		count(distinct reply.reply_id) as replies,
		tweet.date_time
		from
		tweet
		left join like on tweet.tweet_id = like.tweet_id
		left join reply on tweet.tweet_id = reply.tweet_id
		where tweet.user_id = (select user_id from user where username = "${request.username}")
		group by tweet.tweet_id;
	`);
  response.send(
    myTweets.map((item) => {
      const { date_time, ...rest } = item;
      return { ...rest, dateTime: date_time };
    })
  );
});

//api 11
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    let { username } = request;
    const getUserIdQuery = `select user_id from user where username='${username}';`;
    const getUserId = await db.get(getUserIdQuery);
    const getUserTweetsListQuery = `select tweet_id from tweet where user_id=${getUserId.user_id};`;
    const getUserTweetsListArray = await db.all(getUserTweetsListQuery);
    const getUserTweetsList = getUserTweetsListArray.map((eachTweetId) => {
      return eachTweetId.tweet_id;
    });
    console.log(getUserTweetsList);
    if (getUserTweetsList.includes(parseInt(tweetId))) {
      const deleteTweetQuery = `delete from tweet where tweet_id=${tweetId};`;
      await db.run(deleteTweetQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

module.exports = app;
