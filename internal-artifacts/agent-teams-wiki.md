## execute-story
For our current task I want us to create the execute-story command:
- C:\Coding\repos\ACE\commands\ace\execute-story.md
- C:\Coding\repos\ACE\agile-context-engineering\workflows\execute-story.xml
- story summary & state template to be added and nested inside story.xml (to be discussed)  

## Context

### Plan Story Flow
For context and structure see the following flow
  - command: C:\Coding\repos\ACE\commands\ace\plan-story.md
  - workflow: C:\Coding\repos\ACE\agile-context-engineering\workflows\plan-story.xml
  - template: C:\Coding\repos\ACE\agile-context-engineering\templates\product\story.xml (already copmplete - only adjustments if needed)
This command internally calls multiple commands but eventually the result structure, you can see in the story.xml template 

### GSD Execute Phase / Execute Plan / Verify - FOR INSPIRATION
Read the GSD flow in here: C:\Coding\repos\ACE\execute-story-wip\gsd-execution-analysis.md
(repo in here: C:\Coding\repos\ACE\.gsd) 

We can take the relevant stuff from them but please note some differences from GSD:

#### No execute feature
we will not run execute-feature (like GSD runs execute-phase)! In ACE we only run execute-story! 
However, in some cases the story execution won't fit in a single 200k context window. 
Thus I was thinking of using the new CLAUDE CODE AGENT TEAMS feature. Only used when the plan made by Claude code Plan Mode seems fit.   

#### Leverage Claude Code Plan mode
Our execute-story command takes the sotry file / github issue as parameter (which contains ALL the info, Specs plus wiki files plus the entire technical solution)
then the command must swich claude code in plan mode and create a plan based on the information in the story.

#### Summary / STATE 
We add a new section in our story.xml <section name="summary-and-state"> and we write the output directly in the story file and github issue.

#### Checkpoints
If we use agent teams the use can talk directly with any agent right? we do not need to stop, interract with user through main and then main spin up a new agent. We could directly resolve the checkpoint with the agent that's doing the work using agent teams right?

#### Update State
We do not have a Roadmap file but we do have a product-backlog.md file. So the status update in ACE should be:
- Story file & Github Story
  - Update Story State to: DevReady or Done (DevReady when implementation is finished but not manually tested / approved by the user), Done when approved.
  - Update Summary & State section of the story
- Update Feature File & Github Feature
  - Update Story State from the feature file (all stories are listed in the feature file)
  - If it's the last Done story within the feature also update the feature state to Done both in file and github!
- Update the story within product-backlog.md, (again if last done story update the feature state as well inside the product-backlog file)

### Agent Teams
Please read all the info from this page:
https://code.claude.com/docs/en/agent-teams







## Command Workflow/Process Ideas

We need to come up with a plan that creates the flow for this command taking stuff from GSD but adapting to our flow and to agent teams. Here are some ideas, please take them into consideration, but if you feel they are bad, challenge them!

### Command Input
- required paramaters: 
  - the story (either file path or github issue) as required parameter.  
- optional parameters:
  - no optional params
- optional FLAGS:
  - --agent-teams-off (this flag specifically tells the command to NOT use agent-teams no matter if the agent-teams flag is true or false!) 

### Command Output
- the <section name="summary-and-state"> tag inside the story.xml written in both file and github (see ace-tools.js) and the stuff from "#### Update State" - updating the product-backlog and feature as well.
- I think adding a new story tag with the updated/created new wiki files.
- I'm not sure if we need anything else

### agent_teams flag
Our help command adds this flag CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS inside our settings.json file IF the user chooses to (using C:\Coding\repos\ACE\agile-context-engineering\src\ace-tools.js), it's also tracked in our own ACE settings using thie flag "agent_teams": false. The flag may be set to either false or true. The sync-agent-teams command cmdSyncAgentTeams returns { agent_teams: bool, synced: bool } weather the flag is enabled or not.

### Process (NOT SET IN STONE, JUST IDEAS - ENHANCE WITH IDEAS FROM GSD)

#### STEP: ace-tools.js call
The process reads all the story sections USING ACE-TOOLS.js including the technical solution section!
you will probably need to create a function like this: INIT=$(node ~/.claude/agile-context-engineering/src/ace-tools.js init plan-story {story_param}) that extracts all the components from the story.xml
you also need to READ IF AGENT-TEAMS is enabled!

#### STEP: Validation
There are a few critical extractions that need to be validated:
  - the header with Feature file
  - the User Story
  - Description
  - the AC             [CRITICAL - DO NOT CONTINUE IF THIS IS MISSING!]
  - Out of scope
  - Dependencies
  - DoD
  - Relevant Wiki 
  - Technical Solution [CRITICAL - DO NOT CONTINUE IF THIS IS MISSING!]
the external-solution, the integration-solution are not neccesary at this point, the technical solution was already generated with those in mind. We do not want to load them in the context window!

#### STEP: Planning Mode
Then you need to put the agent in planning-mode and use the extracted information ESPECIALLY THE TECHNICAL SOLUTION, in order to MAKE A PLAN for us to execute! 

- IF AGENT-TEAMS ENABLED - I imagine the plan would have to make a decizion if an agent team would be beneficial or if it would only add overhead and waste tokens. Off of the top of my head I'd say that: 
  - if this is a big story 8sp (although estimates may be wrong you need to LOOK INTO TECHNICAL SOLUTION) 
  - if this story cuts through multiple subsystems (heavy changes in one or multiple microservice subsystems, plus heavy changes in qarc-web, and changes in API Gateway)
  - if single subsystem BUT HEAVY COMPLEX SUBSYSTEM CROSS-CUTTING WORK.
  - if you feel that the entire implementation won't fit in one context window (200k -~ 30%)  
you could suggest using a team for implementation. 
- I do not know if the command has to specify cases in which a team is suggested OR if claude code knows to do that by itself! Please research this (search the web)
- Alternatively if the story is samll or isolated, probably no need for suggesting a team.
 
I imagine the calude code planning mode would create tasks suited for agent teams - please fully read https://code.claude.com/docs/en/agent-teams and search the web if needed so that we can understand more of how this works so that we can create a correct workflow.

#### STEP: Team Agent code reviewing OR separate step after implementation
Also I want us to add a: 
  - code review step (in case of NO agent teams) that will spin up a separate ace-code-reviewer agent that looks for TODOs, mocked code, placeholders, Hardcoded values and any mistakes in the implementation. (this is probably similar to GSD verifier C:\Coding\repos\ACE\.gsd\agents\gsd-verifier.md, I see they also have a command: C:\Coding\repos\ACE\.gsd\commands\gsd\verify-work.md not sure if we need to add a command with workflow and all)
  - code review agent (in case of agent teams) that checks what the other agents do, and maybe creates tasks while the other agents are coding if it finds a todo left in the code for example.  

#### STEP: Wiki Update
After the implementation is done and tested and approved by the user the last step would be to spin a Wiki mapper agent C:\Coding\repos\ACE\agents\ace-wiki-mapper.md to update the wiki
After this is done I would like A NEW TAG ADDED IN THE STORY (file plus github) that will show which wikis have been updated and which have been created.

Also I am not sure if we need to create a new agent to wirite the code like GSD has C:\Coding\repos\ACE\.gsd\agents\gsd-executor.md - we totally could, I usually run them with the ace-architect agent but that one has no instructions on the process of the command. 
