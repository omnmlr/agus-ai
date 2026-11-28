[CmdletBinding(DefaultParameterSetName='Ssm')]
param(
    [Parameter(ParameterSetName='Ssm')][string]$Profile,
    [Parameter(ParameterSetName='Ssm')][switch]$InventoryOnly,
    [Parameter(Mandatory,ParameterSetName='Ssh')][ValidatePattern('^[a-zA-Z0-9_.-]+$')][string]$SshAlias
)

$ErrorActionPreference = 'Stop'
$region = 'eu-north-1'
$instance = 'i-0b608f6472205b337'
$script = (Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'host-readiness.sh')).Replace("`r`n","`n")
$encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($script))
if ($PSCmdlet.ParameterSetName -eq 'Ssh') {
    $ssh = (Get-Command ssh -ErrorAction Stop).Source
    & $ssh -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=yes $SshAlias "printf '%s' '$encoded' | base64 -d | bash"
    if ($LASTEXITCODE -ne 0) { throw 'The authorized SSH alias failed to run the read-only host probe.' }
    return
}

$aws = (Get-Command aws -ErrorAction Stop).Source
$options = @('--region',$region,'--output','json','--no-cli-pager','--cli-connect-timeout','10','--cli-read-timeout','25')
if ($Profile) { $options += @('--profile',$Profile) }
function Invoke-AwsJson([string[]]$Arguments) {
    $result = & $aws @options @Arguments
    if ($LASTEXITCODE -ne 0) { throw "AWS $($Arguments[0]) $($Arguments[1]) failed." }
    return ($result -join "`n") | ConvertFrom-Json
}

$null = Invoke-AwsJson @('sts','get-caller-identity')
$inventory = Invoke-AwsJson @('ec2','describe-instances','--instance-ids',$instance,'--query',
    'Reservations[0].Instances[0].{id:InstanceId,state:State.Name,type:InstanceType,architecture:Architecture,publicIp:PublicIpAddress,groups:SecurityGroups[].GroupId}')
if ($inventory.id -ne $instance -or $inventory.state -ne 'running') { throw 'The pinned Stockholm instance is not running.' }
$inventory
if ($inventory.groups.Count) {
    Invoke-AwsJson (@('ec2','describe-security-groups','--group-ids') + @($inventory.groups) +
        @('--query','SecurityGroups[].{group:GroupId,ingress:IpPermissions,egress:IpPermissionsEgress}'))
}
$managed = Invoke-AwsJson @('ssm','describe-instance-information','--filters',"Key=InstanceIds,Values=$instance",
    '--query','InstanceInformationList[0].{id:InstanceId,ping:PingStatus,agent:AgentVersion}')
$managed
if ($inventory.type -like 't*') {
    Invoke-AwsJson @('ec2','describe-instance-credit-specifications','--instance-ids',$instance,
        '--query','InstanceCreditSpecifications[0].{instance:InstanceId,credits:CpuCredits}')
}
$end = [DateTime]::UtcNow
foreach ($metric in 'CPUUtilization','CPUCreditBalance','CPUSurplusCreditBalance','CPUSurplusCreditsCharged') {
    if ($metric -ne 'CPUUtilization' -and $inventory.type -notlike 't*') { continue }
    $stats = if ($metric -eq 'CPUSurplusCreditsCharged') { @('Sum') } else { @('Minimum','Average','Maximum') }
    $series = Invoke-AwsJson (@('cloudwatch','get-metric-statistics','--namespace','AWS/EC2','--metric-name',$metric,
        '--dimensions',"Name=InstanceId,Value=$instance",'--start-time',$end.AddDays(-7).ToString('o'),
        '--end-time',$end.ToString('o'),'--period','3600','--statistics') + $stats)
    [pscustomobject]@{ metric = $metric; samples = $series.Datapoints.Count; points = @($series.Datapoints | Sort-Object Timestamp) }
}
if ($InventoryOnly) { return }
if ($managed.ping -ne 'Online') { throw 'SSM is offline or the current identity cannot see this managed instance.' }

$params = Join-Path $env:TEMP ('agus-ssm-' + [Guid]::NewGuid().ToString('N') + '.json')
try {
    @{commands=@("printf '%s' '$encoded' | base64 -d | bash");executionTimeout=@('60')} |
        ConvertTo-Json -Compress | Set-Content -LiteralPath $params -Encoding ASCII
    $send = Invoke-AwsJson @('ssm','send-command','--instance-ids',$instance,'--document-name','AWS-RunShellScript',
        '--comment','AGUS AI read-only capacity snapshot','--parameters',('file://' + $params))
    $commandId = $send.Command.CommandId
} finally { if ([IO.File]::Exists($params)) { [IO.File]::Delete($params) } }
& $aws @options ssm wait command-executed --command-id $commandId --instance-id $instance
$waitStatus = $LASTEXITCODE
$result = Invoke-AwsJson @('ssm','get-command-invocation','--command-id',$commandId,'--instance-id',$instance)
$result.StandardOutputContent
if ($result.StandardErrorContent) { Write-Warning $result.StandardErrorContent }
if ($waitStatus -ne 0 -or $result.Status -ne 'Success') { throw "Read-only SSM command $commandId ended with $($result.Status)." }
