/** Corporate wellbeing: groups, invitations, group challenges, team charts and the video challenge. */
export const groups = {
  // ---- Groups screen (member side)
  'groups.intro':
    'Groups you belong to through your company or team. Joining a group lets its administrators see your health data; challenges are always optional.',
  'groups.empty': 'You are not in any group yet. When an administrator invites you by email, the invitation shows up here.',

  'groups.invitation.validUntil': 'Invitation · valid until {date}',
  'groups.invitation.consent':
    'I agree that the administrators of {name} can see my health data (sleep, activity and other measurements). I can leave the group at any time.',
  'groups.invitation.accept': 'Accept and join',
  'groups.invitation.acceptFailed': 'Could not accept the invitation.',

  'groups.group.summary_one': '{count} member · joined {date}',
  'groups.group.summary_other': '{count} members · joined {date}',
  'groups.group.challengesLoadFailed': 'Could not load the challenges.',
  'groups.group.noChallenges': 'No challenges yet. When an administrator creates one you will get a notification.',
  'groups.group.leave': 'Leave this group',

  'groups.challenge.failed': 'Something went wrong.',
  'groups.challenge.yourShare': 'Your share',
  'groups.challenge.you': 'You',
  'groups.challenge.contributors': '{participants} of {members} members are adding to the total',
  'groups.challenge.team': 'Team: {status}',
  'groups.challenge.joinNote': 'Only data from the day you join counts — earlier days are not added.',
  'groups.challenge.join': 'Join this challenge',
  'groups.challenge.leave': 'Leave this challenge',
  'groups.challenge.notTakenPart': 'You did not take part in this challenge.',

  // ---- Shared building blocks (parts, chart, formatting, create form)
  'wellbeing.logo.alt': 'Group logo',

  'wellbeing.status.UPCOMING': 'Upcoming',
  'wellbeing.status.ACTIVE': 'Active',
  'wellbeing.status.ENDED': 'Ended',

  'wellbeing.progress.goalReached': '{current} of {required} · goal reached',
  'wellbeing.progress.percent': '{current} of {required} · {percent}%',

  'wellbeing.daysLeft.last': 'Last day',
  'wellbeing.daysLeft_one': '{count} day left',
  'wellbeing.daysLeft_other': '{count} days left',

  'wellbeing.team.nobody': 'Nobody has joined yet.',
  'wellbeing.team.status_one': '{completed} of {count} participant reached the goal · average progress {percent}%',
  'wellbeing.team.status_other': '{completed} of {count} participants reached the goal · average progress {percent}%',

  'wellbeing.target.collective': 'Together reach {amount}',
  'wellbeing.target.sleep_one': '{count} night with a sleep score above {threshold}',
  'wellbeing.target.sleep_other': '{count} nights with a sleep score above {threshold}',
  'wellbeing.target.steps_one': '{count} day with more than {threshold} steps',
  'wellbeing.target.steps_other': '{count} days with more than {threshold} steps',
  'wellbeing.target.workouts_one': '{count} week with more than {threshold} {workouts}',
  'wellbeing.target.workouts_other': '{count} weeks with more than {threshold} {workouts}',
  'wellbeing.target.video_one': 'Watch the video to the end on {count} day',
  'wellbeing.target.video_other': 'Watch the video to the end on {count} days',

  'wellbeing.unit.steps': 'steps',
  'wellbeing.unit.workout_one': 'workout',
  'wellbeing.unit.workout_other': 'workouts',
  'wellbeing.unit.videoSession_one': 'video session',
  'wellbeing.unit.videoSession_other': 'video sessions',
  'wellbeing.unit.session_one': 'session',
  'wellbeing.unit.session_other': 'sessions',

  'wellbeing.collective.lineReached': '{total} of {target} {unit} · goal reached',
  'wellbeing.collective.linePercent': '{total} of {target} {unit} · {percent}%',
  'wellbeing.collective.contribution': '{amount} · {percent}% of the team target',

  'wellbeing.time.justNow': 'just now',
  'wellbeing.time.minutesAgo': '{count} min ago',
  'wellbeing.time.hoursAgo': '{count} h ago',
  'wellbeing.time.daysAgo': '{count} d ago',
  'wellbeing.duration.hoursMinutes': '{hours} h {minutes} min',

  'wellbeing.chart.empty': 'The chart appears once the challenge has started.',
  'wellbeing.chart.title': 'Team total per day',
  'wellbeing.chart.showTable': 'Show as table',
  'wellbeing.chart.hideTable': 'Hide table',
  'wellbeing.chart.a11y': 'Running team total of {total} against the target of {target}',
  'wellbeing.chart.target': 'Target',
  'wellbeing.chart.targetAmount': 'Target {amount}',
  'wellbeing.chart.teamTotal': 'Team total',
  'wellbeing.chart.day': 'Day',
  'wellbeing.chart.thatDay': 'That day',

  'wellbeing.form.steps.typeLabel': 'Steps',
  'wellbeing.form.steps.label': 'Team total of steps',
  'wellbeing.form.steps.hint':
    'All steps of everyone who joins are added up between the first and the last day — there is no daily target, only the total counts.',
  'wellbeing.form.workouts.typeLabel': 'Workouts',
  'wellbeing.form.workouts.label': 'Team total of workouts',
  'wellbeing.form.workouts.hint':
    'All workouts of everyone who joins are added up between the first and the last day — there is no weekly target, only the total counts.',
  'wellbeing.form.video.typeLabel': 'Video',
  'wellbeing.form.video.label': 'Team total of video sessions',
  'wellbeing.form.video.hint':
    'Everyone who joins watches the video to the end; each person can add one session per day. The sessions of the whole team are added up.',
  'wellbeing.form.wholeNumber': 'Enter a whole number, at least 1.',
  'wellbeing.form.videoUrlRequired': 'Paste the YouTube link of the video.',
  'wellbeing.form.videoUrlInvalid': 'This is not a YouTube video link.',
  'wellbeing.form.videoDurationInvalid': 'Enter the length as m:ss, for example 5:00 — or leave it empty.',

  // Messages for failures the server reports with a code or an English text.
  'wellbeing.error.requestFailed': 'Request failed ({status}).',
  'wellbeing.error.ended': 'This challenge has already ended.',
  'wellbeing.error.notFound': 'Not found.',
  'wellbeing.error.notMember': 'You are not a member of this group.',
  'wellbeing.error.invalidDates': 'The challenge cannot end in the past.',

  // ---- Video challenge
  'video.joinToWatch': 'Join the challenge to watch the video and collect sessions.',
  'video.counted_one': 'Counted — you have {count} session so far. Well done!',
  'video.counted_other': 'Counted — you have {count} sessions so far. Well done!',
  'video.alreadyCounted': 'You had already finished the video today, so this one is not added again.',
  'video.doneToday': 'You finished today’s video. Come back tomorrow for the next session.',
  'video.watchAgain': 'Watch it again (not counted)',
  'video.watchToday': 'Watch today’s video ({duration})',
  'video.disclaimer':
    'This is a light movement video for general wellbeing, not medical advice. Do only what feels comfortable, and stop if you feel pain or dizziness. Watching is voluntary. The video counts once it has played to the end — skipping ahead does not count.',
  'video.start': 'Start the video',
  'video.starting': 'Starting…',
  'video.watched': 'Watched',
  'video.watchedOf': '{watched} of {total}',
  'video.counting': 'Counting your session…',
  'video.watchHint': 'Watch to the end to add a session. Playback speed stays at normal.',
  'video.stop': 'Stop',
  'video.countFailed': 'Could not count the video.',
  'video.startFailed': 'Could not start the video.',
  'video.notEnough':
    'Only {watched} of {total} counted as watched. Only continuous playing at normal speed counts — skipping ahead, going back and pausing do not. Start the video again to try once more.',

  'video.player.embed':
    'This video cannot be played inside the app. Ask the administrator to use a video that allows embedding.',
  'video.player.unavailable': 'This video is not available any more.',
  'video.player.generic': 'The video could not be played. Check your connection and try again.',

  'video.refused.tooEarly': 'The video has not been played long enough yet.',
  'video.refused.notWatched': 'The video was not watched to the end.',
  'video.refused.expired': 'This viewing has expired — start the video again.',
  'video.refused.watchNotFound': 'This viewing was not started or is already used.',
  'video.refused.notActive': 'This challenge is not running right now.',
  'video.refused.notParticipant': 'Join the challenge first.',
  'video.refused.notVideo': 'This challenge has no video.',
  'video.refused.unavailable': 'This video is not available.',
} as const;
